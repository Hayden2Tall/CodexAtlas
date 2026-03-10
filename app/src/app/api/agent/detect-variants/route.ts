import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/utils/ai-cost";
import type {
  UserRole,
  User,
  Passage,
  Variant,
} from "@/lib/types";

export const maxDuration = 60;

const ADMIN_ROLES: UserRole[] = ["admin", "editor"];

async function requireAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
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

interface DetectedVariant {
  passage_reference: string;
  description: string;
  readings: {
    manuscript_title: string;
    manuscript_id: string;
    reading_text: string;
    apparatus_notes: string;
  }[];
  significance: "major" | "minor" | "orthographic";
  analysis: string;
}

/**
 * POST /api/agent/detect-variants
 *
 * Compares passages across manuscripts at a given reference to identify
 * textual variants. Uses Claude to analyze differences and classify them.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await requireAdmin(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { passage_reference, passage_ids, force } = body;

    if (!passage_reference && (!Array.isArray(passage_ids) || passage_ids.length < 2)) {
      return NextResponse.json(
        {
          error:
            "Provide a passage_reference to scan across manuscripts, or passage_ids (2+) to compare specific passages",
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    let passages: (Passage & { manuscript_title: string })[];

    if (passage_ids && passage_ids.length >= 2) {
      const { data, error } = await admin
        .from("passages")
        .select("*, manuscripts!inner(title)")
        .in("id", passage_ids)
        .not("original_text", "is", null)
        .returns<(Passage & { manuscripts: { title: string } })[]>();

      if (error || !data || data.length < 2) {
        return NextResponse.json(
          { error: "Need at least 2 passages with original text to compare" },
          { status: 400 }
        );
      }

      passages = data.map((p) => ({
        ...p,
        manuscript_title: p.manuscripts.title,
      }));
    } else {
      const { data, error } = await admin
        .from("passages")
        .select("*, manuscripts!inner(title)")
        .eq("reference", passage_reference)
        .not("original_text", "is", null)
        .returns<(Passage & { manuscripts: { title: string } })[]>();

      if (error || !data || data.length < 2) {
        return NextResponse.json(
          {
            error: `Found ${data?.length ?? 0} passages at reference "${passage_reference}". Need at least 2 to compare.`,
          },
          { status: 400 }
        );
      }

      passages = data.map((p) => ({
        ...p,
        manuscript_title: p.manuscripts.title,
      }));
    }

    // Cache check: look for a previous detection run with these passages
    if (!force) {
      const sortedIds = passages.map((p) => p.id).sort();
      const { data: previousRun } = await admin
        .from("variant_detection_runs")
        .select("id, variants_found, created_at, metadata")
        .eq("passage_reference", passage_reference ?? passages[0]?.reference ?? "custom")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (previousRun) {
        const prevIds = ((previousRun.metadata as Record<string, unknown>)?.passage_ids_sorted as string[] | undefined) ?? [];
        const idsMatch = JSON.stringify(prevIds) === JSON.stringify(sortedIds);

        if (idsMatch) {
          const { data: cachedVariants } = await admin
            .from("variants")
            .select("*, variant_readings(*, manuscripts(id, title, original_language))")
            .eq("detection_run_id", previousRun.id);

          console.log(`[detect-variants] CACHE HIT run=${previousRun.id} variants=${cachedVariants?.length ?? 0}`);

          return NextResponse.json({
            variants: (cachedVariants ?? []).map((v) => ({
              passage_reference: v.passage_reference,
              description: v.description,
              readings: ((v.variant_readings as unknown as { manuscript_id: string; reading_text: string; apparatus_notes: string | null; manuscripts: { title: string; id: string } | null }[]) ?? []).map((r) => ({
                manuscript_title: r.manuscripts?.title ?? "",
                manuscript_id: r.manuscript_id,
                reading_text: r.reading_text,
                apparatus_notes: r.apparatus_notes ?? "",
              })),
              significance: (v.metadata as Record<string, unknown>)?.significance ?? "minor",
              analysis: (v.metadata as Record<string, unknown>)?.analysis ?? "",
            })),
            passages_compared: passages.length,
            cached: true,
            detection_run_id: previousRun.id,
            cached_at: previousRun.created_at,
            usage: { tokens_input: 0, tokens_output: 0, estimated_cost_usd: 0, ai_model: "cached" },
          });
        }
      }
    }

    // Pre-check: if all passages have identical text, skip the AI call entirely
    const normalizedTexts = passages.map((p) =>
      (p.original_text ?? "").replace(/\s+/g, " ").trim()
    );
    const allIdentical = normalizedTexts.every((t) => t === normalizedTexts[0]);

    if (allIdentical) {
      console.log(`[detect-variants] IDENTICAL text across ${passages.length} passages — skipping AI`);
      const sameSource = passages.every(
        (p) =>
          (p.metadata as Record<string, unknown> | null)?.ingested_by === "bible_api" ||
          p.transcription_method === "standard_edition"
      );

      const message = sameSource
        ? "These passages were all imported from the same standard edition text source (e.g., LXX, TR, or WLC). They are identical because they share the same origin — not because the manuscripts agree. For meaningful variant detection, passages need manuscript-specific transcriptions (OCR or scholarly edition)."
        : "All selected passages have identical text. No variants to detect.";

      return NextResponse.json({
        variants: [],
        passages_compared: passages.length,
        identical: true,
        same_source: sameSource,
        message,
        usage: {
          tokens_input: 0,
          tokens_output: 0,
          estimated_cost_usd: 0,
          ai_model: "none",
        },
      });
    }

    const aiModel = "claude-haiku-4-5-20251001";
    const prompt = buildVariantPrompt(passages);

    console.log(`[detect-variants] START ref="${passage_reference ?? "custom"}" passages=${passages.length} model=${aiModel}`);
    console.log(`[detect-variants] Input text lengths: ${passages.map(p => `${p.manuscript_title}=${(p.original_text ?? "").length}`).join(", ")}`);

    const MAX_ATTEMPTS = 2;
    const TIMEOUT_MS = 30_000;
    let rawContent: string | undefined;
    let tokensInput = 0;
    let tokensOutput = 0;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      let anthropicRes: Response;
      try {
        anthropicRes = await fetch(
          "https://api.anthropic.com/v1/messages",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.ANTHROPIC_API_KEY!,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: aiModel,
              max_tokens: 4000,
              messages: [{ role: "user", content: prompt }],
            }),
            signal: controller.signal,
          }
        );
      } catch (fetchErr) {
        clearTimeout(timer);
        const isTimeout = fetchErr instanceof Error && fetchErr.name === "AbortError";
        if (isTimeout && attempt < MAX_ATTEMPTS) {
          console.log(`[detect-variants] Attempt ${attempt} timed out, retrying...`);
          continue;
        }
        console.error(`[detect-variants] ${isTimeout ? "TIMEOUT" : "UNREACHABLE"} after ${attempt} attempt(s)`);
        return NextResponse.json(
          { error: isTimeout ? "Variant detection timed out — try again" : "Variant detection service unreachable" },
          { status: 502 }
        );
      }
      clearTimeout(timer);

      if (!anthropicRes.ok) {
        const detail = await anthropicRes.text();
        console.error(`[detect-variants] API error ${anthropicRes.status}:`, detail.slice(0, 300));
        if (anthropicRes.status >= 500 && attempt < MAX_ATTEMPTS) {
          console.log(`[detect-variants] 5xx, retrying...`);
          continue;
        }
        return NextResponse.json(
          { error: `Variant detection service error (${anthropicRes.status})` },
          { status: 502 }
        );
      }

      const aiResult = await anthropicRes.json();
      rawContent = aiResult.content?.[0]?.text;
      tokensInput = aiResult.usage?.input_tokens ?? 0;
      tokensOutput = aiResult.usage?.output_tokens ?? 0;
      console.log(`[detect-variants] AI response: ${tokensInput} in / ${tokensOutput} out, ${rawContent?.length ?? 0} chars`);
      break;
    }

    const costUsd = estimateCostUsd(aiModel, tokensInput, tokensOutput);

    if (!rawContent) {
      return NextResponse.json(
        { error: "Empty response from variant detection" },
        { status: 502 }
      );
    }

    const detected = parseVariantResponse(rawContent);

    if (!detected) {
      console.error(`[detect-variants] PARSE_FAIL: raw=${rawContent?.slice(0, 500)}`);
      return NextResponse.json(
        { error: "Could not parse variant results" },
        { status: 502 }
      );
    }

    console.log(`[detect-variants] DONE: ${detected.length} variants (${detected.filter(v => v.significance === "major").length} major, ${detected.filter(v => v.significance === "minor").length} minor, ${detected.filter(v => v.significance === "orthographic").length} ortho) cost=$${costUsd.toFixed(4)}`);

    await admin
      .from("agent_tasks")
      .insert({
        task_type: "detect_variants",
        status: "completed",
        config: {
          passage_reference: passage_reference ?? null,
          passage_ids: passage_ids ?? null,
          manuscripts_compared: passages.length,
        },
        result: {
          variants_found: detected.length,
          major: detected.filter((v) => v.significance === "major").length,
          minor: detected.filter((v) => v.significance === "minor").length,
          orthographic: detected.filter((v) => v.significance === "orthographic")
            .length,
        },
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        estimated_cost_usd: costUsd,
        ai_model: aiModel,
        total_items: passages.length,
        completed_items: passages.length,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        created_by: user.id,
      } as Record<string, unknown>);

    return NextResponse.json({
      variants: detected,
      passages_compared: passages.length,
      usage: {
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        estimated_cost_usd: costUsd,
        ai_model: aiModel,
      },
    });
  } catch (err) {
    console.error("[detect-variants] UNHANDLED_ERROR:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agent/detect-variants
 * Saves detected variants to the database (variants + variant_readings).
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await requireAdmin(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { variants, passage_reference, passage_ids, ai_model } = body as {
      variants: DetectedVariant[];
      passage_reference?: string;
      passage_ids?: string[];
      ai_model?: string;
    };

    if (!Array.isArray(variants) || variants.length === 0) {
      return NextResponse.json(
        { error: "variants array is required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const sortedPassageIds = (passage_ids ?? []).sort();
    const ref = passage_reference ?? variants[0]?.passage_reference ?? "unknown";

    const { data: run } = await admin
      .from("variant_detection_runs")
      .insert({
        passage_reference: ref,
        passage_ids: sortedPassageIds,
        model: ai_model ?? "unknown",
        variants_found: variants.length,
        metadata: { passage_ids_sorted: sortedPassageIds },
        created_by: user.id,
      } as Record<string, unknown>)
      .select("id")
      .single<{ id: string }>();

    const runId = run?.id ?? null;

    let variantsCreated = 0;
    let readingsCreated = 0;

    for (const v of variants) {
      const insertData: Record<string, unknown> = {
        passage_reference: v.passage_reference,
        description: v.description,
        metadata: {
          significance: v.significance,
          analysis: v.analysis,
          detected_by: "variant_detection_agent",
        },
        created_by: user.id,
      };
      if (runId) insertData.detection_run_id = runId;

      const { data: variant, error: vErr } = await admin
        .from("variants")
        .insert(insertData)
        .select("id")
        .single<Pick<Variant, "id">>();

      if (vErr || !variant) continue;
      variantsCreated++;

      const readingRows = v.readings
        .filter((r) => r.manuscript_id && r.reading_text)
        .map((r) => ({
          variant_id: variant.id,
          manuscript_id: r.manuscript_id,
          reading_text: r.reading_text,
          apparatus_notes: r.apparatus_notes || null,
          created_by: user.id,
        }));

      if (readingRows.length > 0) {
        const { data: readings } = await admin
          .from("variant_readings")
          .insert(readingRows as Record<string, unknown>[])
          .select("id");

        readingsCreated += readings?.length ?? 0;
      }
    }

    return NextResponse.json({
      variants_created: variantsCreated,
      readings_created: readingsCreated,
      detection_run_id: runId,
    });
  } catch (err) {
    console.error("PUT /api/agent/detect-variants error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

const MAX_PASSAGE_CHARS = 6000;

function buildVariantPrompt(
  passages: (Passage & { manuscript_title: string })[]
): string {
  const passageBlocks = passages
    .map((p) => {
      const text = (p.original_text ?? "").length > MAX_PASSAGE_CHARS
        ? (p.original_text ?? "").slice(0, MAX_PASSAGE_CHARS) + "\n[...truncated]"
        : p.original_text;
      return `Manuscript: "${p.manuscript_title}" (ID: ${p.manuscript_id})\nReference: ${p.reference}\nText:\n"""\n${text}\n"""`;
    })
    .join("\n\n---\n\n");

  return `You are a textual critic. Compare these parallel passages and identify the most significant textual variants.

${passageBlocks}

Identify textual variants (differences in wording, word order, additions, omissions, spelling). Focus on the most significant ones first. Respond ONLY with a JSON array (no markdown, no commentary):

[{"passage_reference":"specific verse/location","description":"what differs","readings":[{"manuscript_title":"Name","manuscript_id":"UUID","reading_text":"text at this point","apparatus_notes":"brief note"}],"significance":"major|minor|orthographic","analysis":"brief scholarly analysis"}]

- "major": changes meaning (different words, additions/omissions)
- "minor": affects nuance (word order, synonyms, grammar)
- "orthographic": spelling only

Include all manuscripts in each reading. Return [] if no variants found.`;
}

function parseVariantResponse(
  raw: string | undefined
): DetectedVariant[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return validateVariants(parsed);
  } catch {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) return validateVariants(parsed);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function validateVariants(
  arr: Record<string, unknown>[]
): DetectedVariant[] {
  return arr
    .filter(
      (v) =>
        typeof v.passage_reference === "string" &&
        Array.isArray(v.readings)
    )
    .map((v) => ({
      passage_reference: String(v.passage_reference),
      description: typeof v.description === "string" ? v.description : "",
      readings: (v.readings as Record<string, unknown>[]).map((r) => ({
        manuscript_title:
          typeof r.manuscript_title === "string" ? r.manuscript_title : "",
        manuscript_id:
          typeof r.manuscript_id === "string" ? r.manuscript_id : "",
        reading_text:
          typeof r.reading_text === "string" ? r.reading_text : "",
        apparatus_notes:
          typeof r.apparatus_notes === "string" ? r.apparatus_notes : "",
      })),
      significance: (["major", "minor", "orthographic"].includes(
        String(v.significance)
      )
        ? String(v.significance)
        : "minor") as "major" | "minor" | "orthographic",
      analysis: typeof v.analysis === "string" ? v.analysis : "",
    }))
    .filter((v) => {
      // Filter out entries where all readings have identical text
      const texts = v.readings.map((r) => r.reading_text.replace(/\s+/g, " ").trim());
      return texts.length < 2 || !texts.every((t) => t === texts[0]);
    });
}
