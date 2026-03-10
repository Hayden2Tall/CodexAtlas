import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/utils/ai-cost";
import type { UserRole, User } from "@/lib/types";

export const maxDuration = 60;

const ADMIN_ROLES: UserRole[] = ["admin", "editor"];

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
  return user;
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
    const user = await requireAdmin(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, original_language, manuscript_id } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const admin = createAdminClient();

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
    }

    const aiModel = "claude-sonnet-4-20250514";
    const prompt = buildTocPrompt(title, original_language ?? "grc");

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: aiModel,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, detail);
      return NextResponse.json(
        { error: "TOC service unavailable" },
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
      console.error("Failed to parse book list. Length:", rawContent.length, "Start:", rawContent.slice(0, 300));
      return NextResponse.json(
        {
          error: "Could not parse manuscript contents",
          debug_length: rawContent.length,
          debug_start: rawContent.slice(0, 200),
        },
        { status: 502 }
      );
    }

    const sections = expandBooksToSections(books);

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
        created_by: user.id,
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
  return `You are a manuscript research assistant. Given a manuscript, list every BOOK or MAJOR SECTION it contains. Do NOT list individual chapters — just the book/section names.

Manuscript: "${title}"
Original language code: "${language}"

Respond ONLY with a JSON array (no markdown fences, no extra text):

[
  {
    "book": "Book or section name (e.g., 'Matthew', 'Genesis', '1 Corinthians', 'Epistle of Barnabas')",
    "chapters": 28,
    "is_biblical": true,
    "notes": "Complete/partial/fragmentary"
  }
]

Rules:
- List every book or major section in the manuscript
- "chapters" is the number of chapters the manuscript contains for that book (not the canonical total if the manuscript is fragmentary)
- "is_biblical" is true for books in the Hebrew Bible, Greek Septuagint, or New Testament canon; false for apocryphal, pseudepigraphal, or other texts
- Order in the manuscript's canonical sequence
- For non-chapter-based texts (letters, poems, folios), use 1 for chapters and set is_biblical to false
- Be concise — just the book list, no descriptions needed`;
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
  is_biblical: boolean;
  notes: string;
}

function expandBooksToSections(books: BookEntry[]): TocSection[] {
  const sections: TocSection[] = [];

  for (const entry of books) {
    const chapterCount = entry.is_biblical
      ? Math.min(entry.chapters, BIBLICAL_CHAPTERS[entry.book] ?? entry.chapters)
      : entry.chapters;

    if (chapterCount <= 1) {
      sections.push({
        reference: entry.book,
        description: entry.notes || "",
        estimated_verses: 25,
      });
    } else {
      for (let ch = 1; ch <= chapterCount; ch++) {
        sections.push({
          reference: `${entry.book} ${ch}`,
          description: ch === 1 ? (entry.notes || "") : "",
          estimated_verses: entry.book === "Psalms" ? 10 : 25,
        });
      }
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
      chapters: typeof b.chapters === "number" ? b.chapters : 1,
      is_biblical: b.is_biblical === true,
      notes: typeof b.notes === "string" ? b.notes : "",
    }));
}
