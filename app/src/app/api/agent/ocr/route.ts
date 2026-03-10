import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/utils/ai-cost";
import type {
  UserRole,
  User,
  ManuscriptImage,
  Manuscript,
  Passage,
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

interface OcrResult {
  passages: {
    reference: string;
    original_text: string;
    confidence: number;
    notes: string;
  }[];
  full_transcription: string;
  language_detected: string;
  quality_assessment: string;
}

/**
 * POST /api/agent/ocr
 *
 * Processes a manuscript image using Claude Vision to extract text.
 * Accepts either a Supabase Storage image ID or a base64 image.
 * Creates passages from the extracted text.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await requireAdmin(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { image_id, image_base64, manuscript_id, page_reference } = body;

    if (!manuscript_id) {
      return NextResponse.json(
        { error: "manuscript_id is required" },
        { status: 400 }
      );
    }

    if (!image_id && !image_base64) {
      return NextResponse.json(
        { error: "Either image_id or image_base64 is required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: manuscript } = await admin
      .from("manuscripts")
      .select("id, title, original_language")
      .eq("id", manuscript_id)
      .single<Pick<Manuscript, "id" | "title" | "original_language">>();

    if (!manuscript) {
      return NextResponse.json(
        { error: "Manuscript not found" },
        { status: 404 }
      );
    }

    let imageSource: { type: "base64"; media_type: string; data: string } | {
      type: "url";
      url: string;
    };

    if (image_base64) {
      const mediaType = detectMediaType(image_base64);
      const cleanBase64 = image_base64.replace(/^data:image\/\w+;base64,/, "");
      imageSource = { type: "base64", media_type: mediaType, data: cleanBase64 };
    } else {
      const { data: imageRecord } = await admin
        .from("manuscript_images")
        .select("storage_path")
        .eq("id", image_id)
        .single<Pick<ManuscriptImage, "storage_path">>();

      if (!imageRecord) {
        return NextResponse.json(
          { error: "Image not found" },
          { status: 404 }
        );
      }

      const { data: signedUrl } = await admin.storage
        .from("manuscript-images")
        .createSignedUrl(imageRecord.storage_path, 300);

      if (!signedUrl?.signedUrl) {
        return NextResponse.json(
          { error: "Could not access image in storage" },
          { status: 500 }
        );
      }

      imageSource = { type: "url", url: signedUrl.signedUrl };
    }

    const aiModel = "claude-sonnet-4-20250514";
    const prompt = buildOcrPrompt(
      manuscript.title,
      manuscript.original_language,
      page_reference ?? "Unknown page"
    );

    const imageContent =
      imageSource.type === "base64"
        ? {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: imageSource.media_type,
              data: imageSource.data,
            },
          }
        : {
            type: "image" as const,
            source: {
              type: "url" as const,
              url: imageSource.url,
            },
          };

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
          max_tokens: 8192,
          messages: [
            {
              role: "user",
              content: [
                imageContent,
                { type: "text", content: prompt },
              ],
            },
          ],
        }),
      }
    );

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text();
      console.error("Anthropic Vision API error:", anthropicRes.status, detail);
      return NextResponse.json(
        { error: "OCR service unavailable" },
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
        { error: "Empty response from OCR service" },
        { status: 502 }
      );
    }

    const parsed = parseOcrResponse(rawContent);
    if (!parsed) {
      console.error("Failed to parse OCR response:", rawContent.slice(0, 500));
      return NextResponse.json(
        { error: "Could not parse OCR results" },
        { status: 502 }
      );
    }

    // Update image record status if we have an image_id
    if (image_id) {
      await admin
        .from("manuscript_images")
        .update({
          ocr_status: "completed",
          metadata: {
            ocr_model: aiModel,
            ocr_quality: parsed.quality_assessment,
            language_detected: parsed.language_detected,
          },
        } as Record<string, unknown>)
        .eq("id", image_id);
    }

    // Track as agent task
    await admin
      .from("agent_tasks")
      .insert({
        task_type: "ocr_process",
        status: "completed",
        config: {
          manuscript_id,
          image_id: image_id ?? null,
          page_reference: page_reference ?? null,
        },
        result: {
          passages_found: parsed.passages.length,
          language_detected: parsed.language_detected,
          quality: parsed.quality_assessment,
        },
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        estimated_cost_usd: costUsd,
        ai_model: aiModel,
        total_items: 1,
        completed_items: 1,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        created_by: user.id,
      } as Record<string, unknown>);

    return NextResponse.json({
      ocr_result: parsed,
      manuscript_id,
      usage: {
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        estimated_cost_usd: costUsd,
        ai_model: aiModel,
      },
    });
  } catch (err) {
    console.error("POST /api/agent/ocr error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent/ocr/save
 * Saves OCR-extracted passages to the database.
 * Separated from OCR so the user can review results before saving.
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await requireAdmin(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { manuscript_id, passages } = body;

    if (!manuscript_id || !Array.isArray(passages) || passages.length === 0) {
      return NextResponse.json(
        { error: "manuscript_id and passages array required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const passageRows = passages.map(
      (
        p: { reference: string; original_text: string; confidence: number },
        i: number
      ) => ({
        manuscript_id,
        reference: p.reference,
        original_text: p.original_text,
        sequence_order: i + 1,
        transcription_method: "ocr_auto",
        created_by: user.id,
        metadata: { ocr_confidence: p.confidence },
      })
    );

    const { data: created, error } = await admin
      .from("passages")
      .insert(passageRows as Record<string, unknown>[])
      .select("id, reference")
      .returns<Pick<Passage, "id" | "reference">[]>();

    if (error) {
      console.error("Failed to save OCR passages:", error);
      return NextResponse.json(
        { error: "Failed to save passages" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      passages_created: created?.length ?? 0,
      passages: created,
    });
  } catch (err) {
    console.error("PUT /api/agent/ocr error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function buildOcrPrompt(
  title: string,
  language: string,
  pageRef: string
): string {
  return `You are a specialist in reading and transcribing ancient manuscripts. Analyze this manuscript image and extract the text.

Manuscript: "${title}"
Expected language: ${language}
Page/Folio: ${pageRef}

Respond ONLY with a JSON object (no markdown fences, no extra text) containing:

{
  "full_transcription": "Complete text from the image in the original script/language",
  "language_detected": "ISO 639-3 code of the language you identified",
  "quality_assessment": "brief assessment of image quality and text legibility",
  "passages": [
    {
      "reference": "Standard scholarly reference for this text section (e.g., Column A lines 1-10, Folio 12r)",
      "original_text": "The transcribed text for this passage section",
      "confidence": 0.85,
      "notes": "Any observations about difficult readings, damage, or uncertain characters"
    }
  ]
}

Guidelines:
- Preserve the original script (Greek, Hebrew, Latin, etc.) as faithfully as possible
- Use Unicode characters appropriate for the detected script
- Break the text into logical passage sections (by column, paragraph, or verse)
- Confidence scores: 0.9+ for clear text, 0.7-0.9 for partially legible, below 0.7 for damaged/unclear
- Mark uncertain characters with [?] and lacunae with [...]
- Note any marginalia, corrections, or interlinear glosses separately`;
}

function parseOcrResponse(raw: string): OcrResult | null {
  try {
    return validateOcrResult(JSON.parse(raw));
  } catch {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return validateOcrResult(JSON.parse(jsonMatch[0]));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function validateOcrResult(obj: Record<string, unknown>): OcrResult | null {
  if (typeof obj.full_transcription !== "string") return null;

  return {
    full_transcription: obj.full_transcription,
    language_detected:
      typeof obj.language_detected === "string" ? obj.language_detected : "unknown",
    quality_assessment:
      typeof obj.quality_assessment === "string" ? obj.quality_assessment : "",
    passages: Array.isArray(obj.passages)
      ? (obj.passages as Record<string, unknown>[])
          .filter((p) => typeof p.original_text === "string")
          .map((p) => ({
            reference: typeof p.reference === "string" ? p.reference : "Unknown",
            original_text: String(p.original_text),
            confidence:
              typeof p.confidence === "number"
                ? Math.max(0, Math.min(1, p.confidence))
                : 0.5,
            notes: typeof p.notes === "string" ? p.notes : "",
          }))
      : [],
  };
}

function detectMediaType(base64OrDataUrl: string): string {
  if (base64OrDataUrl.startsWith("data:image/png")) return "image/png";
  if (base64OrDataUrl.startsWith("data:image/jpeg")) return "image/jpeg";
  if (base64OrDataUrl.startsWith("data:image/webp")) return "image/webp";
  if (base64OrDataUrl.startsWith("data:image/gif")) return "image/gif";
  return "image/jpeg";
}
