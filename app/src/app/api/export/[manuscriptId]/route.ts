import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Manuscript,
  Passage,
  Translation,
  TranslationVersion,
  EvidenceRecord,
  Review,
} from "@/lib/types";

/**
 * GET /api/export/[manuscriptId]?format=json|csv|tei
 *
 * Public endpoint (Open Research Model).
 * Exports a manuscript's complete data including passages,
 * translations, evidence records, and reviews.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ manuscriptId: string }> }
) {
  try {
    const { manuscriptId } = await params;
    const format = request.nextUrl.searchParams.get("format") ?? "json";
    const admin = createAdminClient();

    const { data: manuscript } = await admin
      .from("manuscripts")
      .select("*")
      .eq("id", manuscriptId)
      .single<Manuscript>();

    if (!manuscript) {
      return NextResponse.json(
        { error: "Manuscript not found" },
        { status: 404 }
      );
    }

    const [
      { data: passages },
      { data: translations },
    ] = await Promise.all([
      admin
        .from("passages")
        .select("*")
        .eq("manuscript_id", manuscriptId)
        .order("sequence_order", { ascending: true })
        .returns<Passage[]>(),
      admin
        .from("translations")
        .select("*, translation_versions(*)")
        .in(
          "passage_id",
          (
            await admin
              .from("passages")
              .select("id")
              .eq("manuscript_id", manuscriptId)
          ).data?.map((p: { id: string }) => p.id) ?? []
        )
        .returns<(Translation & { translation_versions: TranslationVersion[] })[]>(),
    ]);

    const versionIds = (translations ?? [])
      .flatMap((t) => t.translation_versions.map((v) => v.id));

    let evidence: EvidenceRecord[] = [];
    let reviews: Review[] = [];

    if (versionIds.length > 0) {
      const [{ data: ev }, { data: rv }] = await Promise.all([
        admin
          .from("evidence_records")
          .select("*")
          .in("entity_id", versionIds)
          .returns<EvidenceRecord[]>(),
        admin
          .from("reviews")
          .select("*")
          .in("translation_version_id", versionIds)
          .returns<Review[]>(),
      ]);
      evidence = ev ?? [];
      reviews = rv ?? [];
    }

    const exportData = {
      manuscript,
      passages: passages ?? [],
      translations: (translations ?? []).map((t) => ({
        ...t,
        versions: t.translation_versions,
      })),
      evidence_records: evidence,
      reviews,
      exported_at: new Date().toISOString(),
      export_version: "1.0",
      source: "CodexAtlas",
    };

    switch (format) {
      case "csv":
        return buildCsvResponse(exportData, manuscript.title);
      case "tei":
        return buildTeiResponse(exportData, manuscript);
      default:
        return NextResponse.json(exportData, {
          headers: {
            "Content-Disposition": `attachment; filename="${slugify(manuscript.title)}.json"`,
          },
        });
    }
  } catch (err) {
    console.error("GET /api/export error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function buildCsvResponse(
  data: {
    manuscript: Manuscript;
    passages: Passage[];
    translations: (Translation & { versions: TranslationVersion[] })[];
  },
  title: string
) {
  const lines: string[] = [
    "passage_reference,original_text,translated_text,target_language,confidence,method,model,version,status",
  ];

  for (const passage of data.passages) {
    const relatedTranslations = data.translations.filter(
      (t) => t.passage_id === passage.id
    );

    if (relatedTranslations.length === 0) {
      lines.push(
        csvRow([passage.reference, passage.original_text ?? "", "", "", "", "", "", "", ""])
      );
      continue;
    }

    for (const translation of relatedTranslations) {
      for (const version of translation.versions) {
        lines.push(
          csvRow([
            passage.reference,
            passage.original_text ?? "",
            version.translated_text,
            translation.target_language,
            String(version.confidence_score ?? ""),
            version.translation_method,
            version.ai_model ?? "",
            String(version.version_number),
            version.status,
          ])
        );
      }
    }
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(title)}.csv"`,
    },
  });
}

function buildTeiResponse(
  data: {
    manuscript: Manuscript;
    passages: Passage[];
    translations: (Translation & { versions: TranslationVersion[] })[];
    evidence_records: EvidenceRecord[];
  },
  manuscript: Manuscript
) {
  const dateStr = manuscript.estimated_date_start
    ? `${manuscript.estimated_date_start}${manuscript.estimated_date_end ? `-${manuscript.estimated_date_end}` : ""}`
    : "unknown";

  const passageBlocks = data.passages
    .map((p) => {
      const latestTranslation = data.translations
        .filter((t) => t.passage_id === p.id)
        .flatMap((t) => t.versions)
        .sort((a, b) => b.version_number - a.version_number)[0];

      const evidenceForVersion = latestTranslation
        ? data.evidence_records.find((e) => e.entity_id === latestTranslation.id)
        : null;

      return `    <div type="passage" n="${escapeXml(p.reference)}">
      <ab xml:lang="${escapeXml(manuscript.original_language)}">${escapeXml(p.original_text ?? "")}</ab>${
        latestTranslation
          ? `
      <ab type="translation" xml:lang="${escapeXml(data.translations.find((t) => t.passage_id === p.id)?.target_language ?? "en")}">
        ${escapeXml(latestTranslation.translated_text)}
      </ab>
      <note type="confidence">${latestTranslation.confidence_score ?? ""}</note>
      <note type="method">${escapeXml(latestTranslation.translation_method)}</note>${
              evidenceForVersion
                ? `
      <note type="ai_model">${escapeXml(evidenceForVersion.ai_model ?? "")}</note>`
                : ""
            }`
          : ""
      }
    </div>`;
    })
    .join("\n");

  const tei = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc>
      <titleStmt>
        <title>${escapeXml(manuscript.title)}</title>
      </titleStmt>
      <publicationStmt>
        <publisher>CodexAtlas</publisher>
        <date>${new Date().toISOString().split("T")[0]}</date>
        <availability>
          <licence>MIT License — Open Research Model</licence>
        </availability>
      </publicationStmt>
      <sourceDesc>
        <msDesc>
          <msIdentifier>
            <settlement>${escapeXml(manuscript.archive_location ?? "")}</settlement>
            <idno>${escapeXml(manuscript.archive_identifier ?? "")}</idno>
          </msIdentifier>
          <msContents>
            <textLang mainLang="${escapeXml(manuscript.original_language)}"/>
          </msContents>
          <history>
            <origin>
              <origDate>${escapeXml(dateStr)}</origDate>
              <origPlace>${escapeXml(manuscript.origin_location ?? "")}</origPlace>
            </origin>
          </history>
        </msDesc>
      </sourceDesc>
    </fileDesc>
  </teiHeader>
  <text>
    <body>
${passageBlocks}
    </body>
  </text>
</TEI>`;

  return new NextResponse(tei, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugify(manuscript.title)}.xml"`,
    },
  });
}

function csvRow(fields: string[]): string {
  return fields
    .map((f) => {
      const escaped = f.replace(/"/g, '""');
      return f.includes(",") || f.includes('"') || f.includes("\n")
        ? `"${escaped}"`
        : escaped;
    })
    .join(",");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
