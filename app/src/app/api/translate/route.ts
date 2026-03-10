import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole, User, Passage, Manuscript, EvidenceRecord, Translation, TranslationVersion } from "@/lib/types";

const SCHOLAR_AND_ABOVE: UserRole[] = ["scholar", "editor", "admin"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { passage_id, target_language } = body;

    if (!passage_id || typeof passage_id !== "string") {
      return NextResponse.json(
        { error: "passage_id is required and must be a string" },
        { status: 400 }
      );
    }
    if (!target_language || typeof target_language !== "string") {
      return NextResponse.json(
        { error: "target_language is required and must be a string" },
        { status: 400 }
      );
    }

    // ── Auth: require scholar role or above ──────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single<Pick<User, "role">>();

    if (!profile || !SCHOLAR_AND_ABOVE.includes(profile.role as UserRole)) {
      return NextResponse.json(
        { error: "Insufficient permissions — scholar role or above required" },
        { status: 403 }
      );
    }

    // ── Fetch passage + manuscript ───────────────────────────────────
    const { data: passage, error: passageError } = await supabase
      .from("passages")
      .select("*")
      .eq("id", passage_id)
      .single<Passage>();

    if (passageError || !passage) {
      return NextResponse.json(
        { error: "Passage not found" },
        { status: 404 }
      );
    }

    if (!passage.original_text) {
      return NextResponse.json(
        { error: "Passage has no original text to translate" },
        { status: 422 }
      );
    }

    const { data: manuscript, error: msError } = await supabase
      .from("manuscripts")
      .select("*")
      .eq("id", passage.manuscript_id)
      .single<Manuscript>();

    if (msError || !manuscript) {
      return NextResponse.json(
        { error: "Manuscript not found" },
        { status: 404 }
      );
    }

    // ── Call Claude API ──────────────────────────────────────────────
    const aiModel = "claude-sonnet-4-20250514";
    const prompt = buildTranslationPrompt(
      passage.original_text,
      manuscript.original_language,
      target_language,
      manuscript.title,
      manuscript.estimated_date_start,
      manuscript.estimated_date_end,
      manuscript.origin_location
    );

    const anthropicRes = await fetch(
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
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        }),
      }
    );

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, detail);
      return NextResponse.json(
        { error: "Translation service unavailable" },
        { status: 502 }
      );
    }

    const aiResult = await anthropicRes.json();
    const rawContent: string | undefined = aiResult.content?.[0]?.text;

    if (!rawContent) {
      return NextResponse.json(
        { error: "Empty response from translation service" },
        { status: 502 }
      );
    }

    const parsed = parseTranslationResponse(rawContent);

    if (!parsed) {
      console.error("Failed to parse AI response:", rawContent.slice(0, 500));
      return NextResponse.json(
        { error: "Failed to parse translation response" },
        { status: 502 }
      );
    }

    // ── Persist to Supabase (admin client bypasses RLS) ──────────────
    const admin = createAdminClient();

    // 1. Evidence record
    const { data: evidenceRecord, error: evErr } = await admin
      .from("evidence_records")
      .insert({
        entity_type: "translation_version",
        entity_id: passage_id,
        source_manuscript_ids: [manuscript.id],
        translation_method: "ai_initial",
        ai_model: aiModel,
        confidence_score: parsed.confidence_score,
        revision_reason: null,
        metadata: {
          translation_notes: parsed.translation_notes,
          key_decisions: parsed.key_decisions,
          target_language,
          original_language: manuscript.original_language,
        },
      } as Record<string, unknown>)
      .select()
      .single<EvidenceRecord>();

    if (evErr || !evidenceRecord) {
      console.error("Evidence record creation failed:", evErr);
      return NextResponse.json(
        { error: "Failed to create evidence record" },
        { status: 500 }
      );
    }

    // 2. Find or create translation row for this passage + language
    let { data: translation } = await admin
      .from("translations")
      .select("*")
      .eq("passage_id", passage_id)
      .eq("target_language", target_language)
      .single<Translation>();

    if (!translation) {
      const { data: created, error: tErr } = await admin
        .from("translations")
        .insert({
          passage_id,
          target_language,
          created_by: user.id,
        } as Record<string, unknown>)
        .select()
        .single<Translation>();

      if (tErr || !created) {
        console.error("Translation creation failed:", tErr);
        return NextResponse.json(
          { error: "Failed to create translation record" },
          { status: 500 }
        );
      }
      translation = created;
    }

    // 3. Determine next version number
    const { count } = await admin
      .from("translation_versions")
      .select("*", { count: "exact", head: true })
      .eq("translation_id", translation.id);

    const versionNumber = (count ?? 0) + 1;

    // 4. Create translation version
    const { data: version, error: vErr } = await admin
      .from("translation_versions")
      .insert({
        translation_id: translation.id,
        version_number: versionNumber,
        translated_text: parsed.translated_text,
        translation_method: "ai_initial",
        ai_model: aiModel,
        confidence_score: parsed.confidence_score,
        source_manuscript_ids: [manuscript.id],
        status: "published",
        evidence_record_id: evidenceRecord.id,
        created_by: user.id,
      } as Record<string, unknown>)
      .select()
      .single<TranslationVersion>();

    if (vErr || !version) {
      console.error("Version creation failed:", vErr);
      return NextResponse.json(
        { error: "Failed to create translation version" },
        { status: 500 }
      );
    }

    // 5. Point evidence record at the actual version
    await admin
      .from("evidence_records")
      .update({ entity_id: version.id } as Record<string, unknown>)
      .eq("id", evidenceRecord.id);

    // 6. Set as current version
    await admin
      .from("translations")
      .update({ current_version_id: version.id } as Record<string, unknown>)
      .eq("id", translation.id);

    return NextResponse.json({
      translation: { ...translation, current_version_id: version.id },
      version,
      evidence_record: evidenceRecord,
    });
  } catch (err) {
    console.error("Translation pipeline error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── Prompt builder ─────────────────────────────────────────────────────

function buildTranslationPrompt(
  originalText: string,
  originalLanguage: string,
  targetLanguage: string,
  manuscriptTitle: string,
  dateStart: number | null,
  dateEnd: number | null,
  origin: string | null
): string {
  const dateRange =
    dateStart && dateEnd
      ? `${dateStart}\u2013${dateEnd} CE`
      : dateStart
        ? `c.\u00A0${dateStart} CE`
        : "unknown date";

  return `You are a scholarly translator of ancient manuscripts. You specialize in faithful, academically rigorous translations that preserve the nuance, structure, and meaning of the original text.

Translate the following passage from ${originalLanguage} to ${targetLanguage}.

Source manuscript: "${manuscriptTitle}"
Estimated date: ${dateRange}
Origin: ${origin ?? "unknown"}

Original text:
"""
${originalText}
"""

Respond ONLY with a JSON object (no markdown fences, no extra text) containing exactly these fields:

{
  "translated_text": "The full scholarly translation",
  "confidence_score": 0.85,
  "translation_notes": "Brief scholarly notes on the translation approach and any difficulties",
  "key_decisions": [
    "Description of a significant translation choice and why you made it"
  ]
}

Guidelines for the confidence_score (0\u20131):
- 0.95+    : Standard text with well-known vocabulary and grammar
- 0.80\u20130.94 : Minor ambiguities but strong scholarly consensus
- 0.60\u20130.79 : Significant ambiguities or disputed readings
- 0.30\u20130.59 : Fragmentary text or highly uncertain vocabulary
- Below 0.30 : Largely speculative reconstruction`;
}

// ── Response parser ────────────────────────────────────────────────────

interface ParsedTranslation {
  translated_text: string;
  confidence_score: number;
  translation_notes: string;
  key_decisions: string[];
}

function parseTranslationResponse(raw: string): ParsedTranslation | null {
  try {
    return validateParsed(JSON.parse(raw));
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return validateParsed(JSON.parse(jsonMatch[0]));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function validateParsed(obj: Record<string, unknown>): ParsedTranslation | null {
  if (typeof obj.translated_text !== "string" || !obj.translated_text) {
    return null;
  }

  return {
    translated_text: obj.translated_text,
    confidence_score:
      typeof obj.confidence_score === "number"
        ? Math.max(0, Math.min(1, obj.confidence_score))
        : 0.5,
    translation_notes:
      typeof obj.translation_notes === "string"
        ? obj.translation_notes
        : "",
    key_decisions: Array.isArray(obj.key_decisions)
      ? obj.key_decisions.map(String)
      : [],
  };
}
