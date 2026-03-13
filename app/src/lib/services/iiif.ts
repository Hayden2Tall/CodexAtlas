/**
 * IIIF Presentation API service — supports v2 and v3 manifests.
 *
 * Used by:
 *   - /api/iiif/harvest  (bulk metadata import from IIIF institutions)
 *   - /api/agent/ocr    (on-demand page image retrieval via iiif_page_index)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal typed representation of a IIIF Presentation API v2 manifest. */
interface IiifV2Manifest {
  "@context": string;
  "@type": "sc:Manifest";
  label: string | { "@value": string }[];
  description?: string | { "@value": string }[];
  metadata?: Array<{ label: string; value: string | { "@value": string }[] }>;
  within?: string | { "@id": string };
  sequences?: Array<{
    canvases?: Array<{
      "@id": string;
      label: string;
      images?: Array<{
        resource?: {
          "@id": string;
          "@type"?: string;
          service?: { "@id": string };
        };
      }>;
      thumbnail?: string | { "@id": string };
    }>;
  }>;
}

/** Minimal typed representation of a IIIF Presentation API v3 manifest. */
interface IiifV3Manifest {
  "@context": string | string[];
  type: "Manifest";
  label: Record<string, string[]>;
  summary?: Record<string, string[]>;
  metadata?: Array<{
    label: Record<string, string[]>;
    value: Record<string, string[]>;
  }>;
  items?: Array<{
    id: string;
    label?: Record<string, string[]>;
    items?: Array<{
      items?: Array<{
        body?: { id: string; type?: string; service?: Array<{ id: string }> };
      }>;
    }>;
    thumbnail?: Array<{ id: string }>;
  }>;
}

export type IiifManifest = IiifV2Manifest | IiifV3Manifest;

export interface ManuscriptMetadata {
  title: string;
  description: string | null;
  estimatedDateStart: number | null;
  estimatedDateEnd: number | null;
  archiveLocation: string | null;
  archiveIdentifier: string | null;
  language: string | null;
  thumbnailUrl: string | null;
  pageCount: number;
  iiifManifestUrl: string;
}

export interface IiifPage {
  sequence: number;
  label: string;
  imageUrl: string;
  thumbnailUrl: string | null;
}

// ---------------------------------------------------------------------------
// Institutions
// ---------------------------------------------------------------------------

export const IIIF_INSTITUTIONS: Record<
  string,
  {
    name: string;
    collectionUrl: string;
    approximateCount: number;
  }
> = {
  "e-codices": {
    name: "e-codices (Virtual Manuscript Library of Switzerland)",
    collectionUrl: "https://www.e-codices.unifr.ch/metadata/iiif/collection.json",
    approximateCount: 1700,
  },
  vatican: {
    name: "Vatican DigiVatLib",
    collectionUrl: "https://digi.vatlib.it/iiif/collection",
    approximateCount: 80000,
  },
  "british-library": {
    name: "British Library Digitised Manuscripts",
    collectionUrl: "https://api.bl.uk/metadata/iiif/index.json",
    approximateCount: 3000,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isV3(manifest: IiifManifest): manifest is IiifV3Manifest {
  // v3 uses "type": "Manifest"; v2 uses "@type": "sc:Manifest"
  return (manifest as IiifV3Manifest).type === "Manifest";
}

function stringLabel(
  raw: string | string[] | { "@value": string }[] | Record<string, string[]> | undefined
): string | null {
  if (!raw) return null;
  if (typeof raw === "string") return raw.trim() || null;
  if (Array.isArray(raw)) {
    const first = raw[0] as string | { "@value": string } | undefined;
    if (!first) return null;
    return typeof first === "string"
      ? first.trim()
      : (first as { "@value": string })["@value"]?.trim() ?? null;
  }
  // v3 language-map: take first available language value
  const vals = Object.values(raw as Record<string, string[]>);
  return vals[0]?.[0]?.trim() ?? null;
}

function parseYearRange(raw: string | null): {
  start: number | null;
  end: number | null;
} {
  if (!raw) return { start: null, end: null };
  // e.g. "1200-1250", "13th century", "ca. 1100", "1150"
  const range = raw.match(/(\d{3,4})\s*[-–]\s*(\d{3,4})/);
  if (range) {
    return { start: parseInt(range[1], 10), end: parseInt(range[2], 10) };
  }
  const single = raw.match(/\b(\d{3,4})\b/);
  if (single) {
    const y = parseInt(single[1], 10);
    return { start: y, end: y };
  }
  return { start: null, end: null };
}

// ---------------------------------------------------------------------------
// Core API functions
// ---------------------------------------------------------------------------

/**
 * Fetch and parse a IIIF manifest (v2 or v3).
 */
export async function fetchManifest(url: string): Promise<IiifManifest> {
  const res = await fetch(url, {
    headers: { Accept: "application/ld+json, application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`IIIF manifest fetch failed: ${res.status} ${url}`);
  return res.json() as Promise<IiifManifest>;
}

/**
 * Extract structured manuscript metadata from a IIIF manifest.
 */
export function extractManuscriptMetadata(
  manifest: IiifManifest,
  manifestUrl: string
): ManuscriptMetadata {
  if (isV3(manifest)) {
    return extractV3Metadata(manifest, manifestUrl);
  }
  return extractV2Metadata(manifest as IiifV2Manifest, manifestUrl);
}

function extractV2Metadata(
  manifest: IiifV2Manifest,
  manifestUrl: string
): ManuscriptMetadata {
  const title = stringLabel(manifest.label) ?? "Untitled";
  const description = stringLabel(manifest.description as string | undefined) ?? null;

  // Extract metadata fields
  const metaMap: Record<string, string> = {};
  for (const m of manifest.metadata ?? []) {
    const key =
      typeof m.label === "string" ? m.label : (m.label as unknown as string);
    const val = stringLabel(m.value as string | { "@value": string }[]);
    if (key && val) metaMap[key.toLowerCase()] = val;
  }

  const dateRaw =
    metaMap["date"] ??
    metaMap["dates"] ??
    metaMap["date created"] ??
    metaMap["created"] ??
    null;
  const { start, end } = parseYearRange(dateRaw);

  const canvases = manifest.sequences?.[0]?.canvases ?? [];
  const thumbnailUrl =
    typeof canvases[0]?.thumbnail === "string"
      ? canvases[0].thumbnail
      : (canvases[0]?.thumbnail as { "@id": string } | undefined)?.["@id"] ??
        null;

  return {
    title,
    description,
    estimatedDateStart: start,
    estimatedDateEnd: end,
    archiveLocation:
      metaMap["repository"] ??
      metaMap["holding institution"] ??
      metaMap["institution"] ??
      null,
    archiveIdentifier:
      metaMap["shelfmark"] ??
      metaMap["call number"] ??
      metaMap["identifier"] ??
      null,
    language:
      metaMap["language"] ?? metaMap["languages"] ?? null,
    thumbnailUrl,
    pageCount: canvases.length,
    iiifManifestUrl: manifestUrl,
  };
}

function extractV3Metadata(
  manifest: IiifV3Manifest,
  manifestUrl: string
): ManuscriptMetadata {
  const title = stringLabel(manifest.label) ?? "Untitled";
  const description = stringLabel(manifest.summary) ?? null;

  const metaMap: Record<string, string> = {};
  for (const m of manifest.metadata ?? []) {
    const key = stringLabel(m.label);
    const val = stringLabel(m.value);
    if (key && val) metaMap[key.toLowerCase()] = val;
  }

  const dateRaw =
    metaMap["date"] ??
    metaMap["dates"] ??
    metaMap["date created"] ??
    metaMap["created"] ??
    null;
  const { start, end } = parseYearRange(dateRaw);

  const canvases = manifest.items ?? [];
  const thumbnailUrl = canvases[0]?.thumbnail?.[0]?.id ?? null;

  return {
    title,
    description,
    estimatedDateStart: start,
    estimatedDateEnd: end,
    archiveLocation:
      metaMap["repository"] ??
      metaMap["holding institution"] ??
      metaMap["institution"] ??
      null,
    archiveIdentifier:
      metaMap["shelfmark"] ??
      metaMap["call number"] ??
      metaMap["identifier"] ??
      null,
    language:
      metaMap["language"] ?? metaMap["languages"] ?? null,
    thumbnailUrl,
    pageCount: canvases.length,
    iiifManifestUrl: manifestUrl,
  };
}

/**
 * Extract ordered page list from a IIIF manifest.
 */
export function listPages(manifest: IiifManifest): IiifPage[] {
  if (isV3(manifest)) {
    return listV3Pages(manifest);
  }
  return listV2Pages(manifest as IiifV2Manifest);
}

function listV2Pages(manifest: IiifV2Manifest): IiifPage[] {
  const canvases = manifest.sequences?.[0]?.canvases ?? [];
  return canvases
    .map((canvas, i) => {
      const imageId =
        canvas.images?.[0]?.resource?.["@id"] ?? null;
      return {
        sequence: i,
        label: stringLabel(canvas.label as string) ?? `Page ${i + 1}`,
        imageUrl: imageId ?? "",
        thumbnailUrl:
          typeof canvas.thumbnail === "string"
            ? canvas.thumbnail
            : (canvas.thumbnail as { "@id": string } | undefined)?.["@id"] ??
              null,
      };
    })
    .filter((p) => p.imageUrl.length > 0);
}

function listV3Pages(manifest: IiifV3Manifest): IiifPage[] {
  const canvases = manifest.items ?? [];
  return canvases
    .map((canvas, i) => {
      const body =
        canvas.items?.[0]?.items?.[0]?.body;
      const imageUrl = body?.id ?? "";
      return {
        sequence: i,
        label: stringLabel(canvas.label) ?? `Page ${i + 1}`,
        imageUrl,
        thumbnailUrl: canvas.thumbnail?.[0]?.id ?? null,
      };
    })
    .filter((p) => p.imageUrl.length > 0);
}

/**
 * Fetch a IIIF collection and return all manifest URLs it contains.
 * Handles both v2 collections (members[]) and v3 collections (items[]).
 */
export async function fetchCollection(
  collectionUrl: string
): Promise<string[]> {
  const res = await fetch(collectionUrl, {
    headers: { Accept: "application/ld+json, application/json" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok)
    throw new Error(`IIIF collection fetch failed: ${res.status} ${collectionUrl}`);
  const data = (await res.json()) as Record<string, unknown>;

  const manifestUrls: string[] = [];

  // v2: manifests[] or members[]
  const members =
    (data["manifests"] as unknown[]) ??
    (data["members"] as unknown[]) ??
    (data["items"] as unknown[]) ??
    [];

  for (const item of members) {
    if (typeof item === "object" && item !== null) {
      const obj = item as Record<string, unknown>;
      const type =
        (obj["@type"] as string | undefined) ??
        (obj["type"] as string | undefined) ??
        "";
      const id =
        (obj["@id"] as string | undefined) ??
        (obj["id"] as string | undefined) ??
        "";

      if (
        type === "sc:Manifest" ||
        type === "Manifest" ||
        id.includes("/manifest")
      ) {
        if (id) manifestUrls.push(id);
      }
    }
  }

  return manifestUrls;
}
