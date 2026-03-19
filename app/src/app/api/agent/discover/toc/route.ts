import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/utils/ai-cost";
import { getAnthropicApiKey } from "@/lib/utils/contributor-api-key";
import type { UserRole, User } from "@/lib/types";

export const maxDuration = 60;

const ADMIN_ROLES: UserRole[] = ["admin", "editor", "contributor"];

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single<Pick<User, "role">>();
  if (!profile || !ADMIN_ROLES.includes(profile.role as UserRole)) return null;
  return { userId: user.id, role: profile.role };
}

export interface TocSection {
  reference: string;
  description: string;
  estimated_verses: number;
}

/**
 * POST /api/agent/discover/toc
 *
 * Given a manuscript title and language, asks Claude for a complete table
 * of contents listing every major section/chapter in the manuscript.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireAdmin(supabase);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userId, role } = auth;
    const apiKeyResult = await getAnthropicApiKey(userId, role);
    if ("error" in apiKeyResult) {
      return NextResponse.json({ error: apiKeyResult.error }, { status: apiKeyResult.status });
    }
    const anthropicApiKey = apiKeyResult.key;

    const body = await request.json();
    const { title, original_language, manuscript_id } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    console.log(`[toc] START title="${title}" lang="${original_language ?? "grc"}" manuscriptId=${manuscript_id ?? "none"}`);

    // Get existing passages for this manuscript to mark what's already imported
    let existingRefs: string[] = [];
    if (manuscript_id) {
      const { data: passages } = await admin
        .from("passages")
        .select("reference")
        .eq("manuscript_id", manuscript_id);
      existingRefs = (passages ?? []).map(
        (p: { reference: string }) => p.reference.toLowerCase().trim()
      );
      console.log(`[toc] Found ${existingRefs.length} existing passages: [${existingRefs.slice(0, 10).join(", ")}${existingRefs.length > 10 ? "..." : ""}]`);
    }

    const aiModel = "claude-haiku-4-5-20251001";
    const prompt = buildTocPrompt(title, original_language ?? "grc");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);

    let anthropicRes: Response;
    try {
      anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: aiModel,
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      const isTimeout = fetchErr instanceof Error && fetchErr.name === "AbortError";
      return NextResponse.json(
        { error: isTimeout ? "TOC scan timed out — try again" : "TOC service unreachable" },
        { status: 502 }
      );
    }
    clearTimeout(timeout);

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, detail);
      return NextResponse.json(
        { error: `TOC service error (${anthropicRes.status})` },
        { status: 502 }
      );
    }

    const aiResult = await anthropicRes.json();
    const rawContent: string | undefined = aiResult.content?.[0]?.text;
    const tokensInput: number = aiResult.usage?.input_tokens ?? 0;
    const tokensOutput: number = aiResult.usage?.output_tokens ?? 0;
    const costUsd = estimateCostUsd(aiModel, tokensInput, tokensOutput);

    if (!rawContent) {
      return NextResponse.json(
        { error: "Empty response from TOC service" },
        { status: 502 }
      );
    }

    const books = parseBookListResponse(rawContent);

    if (!books || books.length === 0) {
      console.error(`[toc] PARSE_FAIL title="${title}" rawLen=${rawContent.length} raw=${rawContent.slice(0, 400)}`);
      return NextResponse.json(
        {
          error: "Could not parse manuscript contents",
          debug_length: rawContent.length,
          debug_start: rawContent.slice(0, 200),
        },
        { status: 502 }
      );
    }

    console.log(`[toc] PARSED ${books.length} books: ${books.map(b => `${b.book}(ch${b.chapter_start}-${b.chapter_start + b.chapters - 1}, ${b.notes || "no notes"})`).join(", ")}`);

    const sections = expandBooksToSections(books);
    console.log(`[toc] EXPANDED to ${sections.length} sections: [${sections.slice(0, 8).map(s => s.reference).join(", ")}${sections.length > 8 ? "..." : ""}]`);

    const results = sections.map((s) => ({
      ...s,
      already_imported: existingRefs.some(
        (r) =>
          r === s.reference.toLowerCase().trim() ||
          r.startsWith(s.reference.toLowerCase().trim()) ||
          s.reference.toLowerCase().trim().startsWith(r)
      ),
    }));

    // Estimate cost of importing all unimported sections
    const unimportedCount = results.filter((r) => !r.already_imported).length;
    const estimatedImportCostPerSection = 0.015; // ~$0.015 per section text retrieval
    const estimatedTotalImportCost = unimportedCount * estimatedImportCostPerSection;

    await admin
      .from("agent_tasks")
      .insert({
        task_type: "discover_manuscript",
        status: "completed",
        config: { mode: "toc", title, original_language },
        result: { sections_found: sections.length, already_imported: results.filter((r) => r.already_imported).length },
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        estimated_cost_usd: costUsd,
        ai_model: aiModel,
        total_items: sections.length,
        completed_items: sections.length,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        created_by: userId,
      } as Record<string, unknown>);

    return NextResponse.json({
      sections: results,
      total_sections: sections.length,
      already_imported: results.filter((r) => r.already_imported).length,
      estimated_import_cost: estimatedTotalImportCost,
      usage: {
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        estimated_cost_usd: costUsd,
        ai_model: aiModel,
      },
    });
  } catch (err) {
    console.error("POST /api/agent/discover/toc error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function buildTocPrompt(title: string, language: string): string {
  return `You are a manuscript research assistant. Given a manuscript, list every BOOK or MAJOR SECTION it contains.

Manuscript: "${title}"
Original language code: "${language}"

Respond ONLY with a JSON array (no markdown fences, no extra text):

[
  {
    "book": "Book or section name (e.g., 'Matthew', 'Genesis', '1 Corinthians', 'Epistle of Barnabas')",
    "chapters": 28,
    "chapter_start": 1,
    "is_biblical": true,
    "notes": "Complete/partial/fragmentary"
  }
]

Rules:
- "chapters" is how many chapters this manuscript contains for that book. For fragmentary manuscripts that only contain part of a book, set this to the number of chapters actually present.
- "chapter_start" is the first chapter number present in this manuscript for that book. Default is 1. For example, if only chapters 18-21 of John survive, set chapter_start to 18 and chapters to 4.
- CRITICAL: For fragmentary manuscripts containing only part of one chapter, set chapters to 1 and chapter_start to the actual chapter number. Example: Papyrus 52 contains a fragment of John 18, so: {"book":"John","chapters":1,"chapter_start":18,"is_biblical":true,"notes":"fragmentary, John 18:31-33,37-38 only"}
- "is_biblical" is true for books in the Hebrew Bible, Greek Septuagint, or New Testament canon
- For single-chapter biblical books (Philemon, Jude, Obadiah, 2 John, 3 John), set chapters to 1 and chapter_start to 1
- For non-chapter-based texts (letters, poems, folios), set chapters to 1
- Order in the manuscript's canonical sequence`;
}

// Biblical book chapter counts (canonical)
const BIBLICAL_CHAPTERS: Record<string, number> = {
  "Genesis": 50, "Exodus": 40, "Leviticus": 27, "Numbers": 36, "Deuteronomy": 34,
  "Joshua": 24, "Judges": 21, "Ruth": 4, "1 Samuel": 31, "2 Samuel": 24,
  "1 Kings": 22, "2 Kings": 25, "1 Chronicles": 29, "2 Chronicles": 36,
  "Ezra": 10, "Nehemiah": 13, "Esther": 10, "Job": 42, "Psalms": 150,
  "Proverbs": 31, "Ecclesiastes": 12, "Song of Solomon": 8,
  "Isaiah": 66, "Jeremiah": 52, "Lamentations": 5, "Ezekiel": 48, "Daniel": 12,
  "Hosea": 14, "Joel": 3, "Amos": 9, "Obadiah": 1, "Jonah": 4, "Micah": 7,
  "Nahum": 3, "Habakkuk": 3, "Zephaniah": 3, "Haggai": 2, "Zechariah": 14, "Malachi": 4,
  "Matthew": 28, "Mark": 16, "Luke": 24, "John": 21, "Acts": 28,
  "Romans": 16, "1 Corinthians": 16, "2 Corinthians": 13, "Galatians": 6,
  "Ephesians": 6, "Philippians": 4, "Colossians": 4,
  "1 Thessalonians": 5, "2 Thessalonians": 3, "1 Timothy": 6, "2 Timothy": 4,
  "Titus": 3, "Philemon": 1, "Hebrews": 13, "James": 5,
  "1 Peter": 5, "2 Peter": 3, "1 John": 5, "2 John": 1, "3 John": 1,
  "Jude": 1, "Revelation": 22,
  "Tobit": 14, "Judith": 16, "Wisdom": 19, "Sirach": 51,
  "Baruch": 6, "1 Maccabees": 16, "2 Maccabees": 15,
};

interface BookEntry {
  book: string;
  chapters: number;
  chapter_start: number;
  is_biblical: boolean;
  notes: string;
}

// Known single-chapter biblical books — reference is just the book name
const SINGLE_CHAPTER_BOOKS = new Set([
  "Obadiah", "Philemon", "2 John", "3 John", "Jude",
]);

function expandBooksToSections(books: BookEntry[]): TocSection[] {
  const sections: TocSection[] = [];

  for (const entry of books) {
    const canonicalMax = BIBLICAL_CHAPTERS[entry.book] ?? 0;
    const chapterCount = entry.is_biblical && canonicalMax > 0
      ? Math.min(entry.chapters, canonicalMax)
      : entry.chapters;
    const startCh = entry.chapter_start || 1;

    // Single-chapter books: reference is just the book name
    if (SINGLE_CHAPTER_BOOKS.has(entry.book) || (!entry.is_biblical && chapterCount <= 1 && canonicalMax === 0)) {
      sections.push({
        reference: entry.book,
        description: entry.notes || "",
        estimated_verses: 25,
      });
      continue;
    }

    // Multi-chapter books (or fragments of them): always include chapter number
    const endCh = startCh + chapterCount - 1;
    for (let ch = startCh; ch <= endCh; ch++) {
      if (entry.is_biblical && canonicalMax > 0 && ch > canonicalMax) break;
      sections.push({
        reference: `${entry.book} ${ch}`,
        description: ch === startCh ? (entry.notes || "") : "",
        estimated_verses: entry.book === "Psalms" ? 10 : 25,
      });
    }
  }

  return sections;
}

function parseBookListResponse(raw: string): BookEntry[] | null {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return validateBooks(parsed);
  } catch {
    // noop
  }

  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) return validateBooks(parsed);
    } catch {
      // noop
    }
  }

  // Handle truncated JSON
  const arrayStart = cleaned.indexOf("[");
  if (arrayStart >= 0) {
    let truncated = cleaned.slice(arrayStart);
    const lastCloseBrace = truncated.lastIndexOf("}");
    if (lastCloseBrace > 0) {
      truncated = truncated.slice(0, lastCloseBrace + 1) + "]";
      try {
        const parsed = JSON.parse(truncated);
        if (Array.isArray(parsed)) return validateBooks(parsed);
      } catch {
        // noop
      }
    }
  }

  return null;
}

function validateBooks(arr: Record<string, unknown>[]): BookEntry[] {
  return arr
    .filter((b) => typeof b.book === "string" && b.book.length > 0)
    .map((b) => ({
      book: String(b.book),
      chapters: typeof b.chapters === "number" && b.chapters > 0 ? b.chapters : 1,
      chapter_start: typeof b.chapter_start === "number" && b.chapter_start > 0 ? b.chapter_start : 1,
      is_biblical: b.is_biblical === true,
      notes: typeof b.notes === "string" ? b.notes : "",
    }));
}
