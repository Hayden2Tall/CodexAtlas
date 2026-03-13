import { describe, it, expect } from "vitest";
import {
  extractManuscriptMetadata,
  listPages,
  IIIF_INSTITUTIONS,
} from "@/lib/services/iiif";
import type { IiifManifest } from "@/lib/services/iiif";

// ---------------------------------------------------------------------------
// Fixture manifests
// ---------------------------------------------------------------------------

const V2_MANIFEST: IiifManifest = {
  "@context": "http://iiif.io/api/presentation/2/context.json",
  "@type": "sc:Manifest",
  label: "Codex Vaticanus",
  description: "Ancient Greek Bible manuscript",
  metadata: [
    { label: "Date", value: "4th century" },
    { label: "Repository", value: "Vatican Library" },
    { label: "Shelfmark", value: "Vat. gr. 1209" },
    { label: "Language", value: "Greek" },
  ],
  sequences: [
    {
      canvases: [
        {
          "@id": "https://example.com/canvas/1",
          label: "fol. 1r",
          images: [
            {
              resource: {
                "@id": "https://example.com/image/1/full/max/0/default.jpg",
              },
            },
          ],
          thumbnail: { "@id": "https://example.com/image/1/full/80,/0/default.jpg" },
        },
        {
          "@id": "https://example.com/canvas/2",
          label: "fol. 1v",
          images: [
            {
              resource: {
                "@id": "https://example.com/image/2/full/max/0/default.jpg",
              },
            },
          ],
        },
      ],
    },
  ],
} as unknown as IiifManifest;

const V3_MANIFEST: IiifManifest = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  type: "Manifest",
  label: { en: ["Codex Alexandrinus"] },
  summary: { en: ["5th century Greek Bible"] },
  metadata: [
    {
      label: { en: ["Date"] },
      value: { en: ["400-440 CE"] },
    },
    {
      label: { en: ["Repository"] },
      value: { en: ["British Library"] },
    },
    {
      label: { en: ["Language"] },
      value: { en: ["Greek"] },
    },
  ],
  items: [
    {
      id: "https://example.com/canvas/1",
      label: { en: ["fol. 1r"] },
      items: [
        {
          items: [
            {
              body: { id: "https://example.com/image/1.jpg", type: "Image" },
            },
          ],
        },
      ],
      thumbnail: [{ id: "https://example.com/thumb/1.jpg" }],
    },
    {
      id: "https://example.com/canvas/2",
      label: { en: ["fol. 1v"] },
      items: [
        {
          items: [
            {
              body: { id: "https://example.com/image/2.jpg", type: "Image" },
            },
          ],
        },
      ],
    },
  ],
} as unknown as IiifManifest;

// ---------------------------------------------------------------------------
// extractManuscriptMetadata (v2)
// ---------------------------------------------------------------------------
describe("extractManuscriptMetadata — v2", () => {
  const meta = extractManuscriptMetadata(V2_MANIFEST, "https://example.com/manifest.json");

  it("extracts title", () => {
    expect(meta.title).toBe("Codex Vaticanus");
  });

  it("extracts description", () => {
    expect(meta.description).toBe("Ancient Greek Bible manuscript");
  });

  it("extracts archive location", () => {
    expect(meta.archiveLocation).toBe("Vatican Library");
  });

  it("extracts archive identifier", () => {
    expect(meta.archiveIdentifier).toBe("Vat. gr. 1209");
  });

  it("extracts language", () => {
    expect(meta.language).toBe("Greek");
  });

  it("extracts page count", () => {
    expect(meta.pageCount).toBe(2);
  });

  it("extracts thumbnail URL", () => {
    expect(meta.thumbnailUrl).toBe("https://example.com/image/1/full/80,/0/default.jpg");
  });

  it("stores manifest URL", () => {
    expect(meta.iiifManifestUrl).toBe("https://example.com/manifest.json");
  });
});

// ---------------------------------------------------------------------------
// extractManuscriptMetadata (v3)
// ---------------------------------------------------------------------------
describe("extractManuscriptMetadata — v3", () => {
  const meta = extractManuscriptMetadata(V3_MANIFEST, "https://example.com/v3/manifest.json");

  it("extracts title from language map", () => {
    expect(meta.title).toBe("Codex Alexandrinus");
  });

  it("extracts description from summary", () => {
    expect(meta.description).toBe("5th century Greek Bible");
  });

  it("extracts date range from metadata", () => {
    // "400-440 CE" → start 400, end 440
    expect(meta.estimatedDateStart).toBe(400);
    expect(meta.estimatedDateEnd).toBe(440);
  });

  it("extracts archive location", () => {
    expect(meta.archiveLocation).toBe("British Library");
  });

  it("extracts page count", () => {
    expect(meta.pageCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// listPages (v2)
// ---------------------------------------------------------------------------
describe("listPages — v2", () => {
  const pages = listPages(V2_MANIFEST);

  it("returns correct number of pages", () => {
    expect(pages.length).toBe(2);
  });

  it("extracts image URLs", () => {
    expect(pages[0].imageUrl).toBe("https://example.com/image/1/full/max/0/default.jpg");
    expect(pages[1].imageUrl).toBe("https://example.com/image/2/full/max/0/default.jpg");
  });

  it("extracts page labels", () => {
    expect(pages[0].label).toBe("fol. 1r");
    expect(pages[1].label).toBe("fol. 1v");
  });

  it("assigns sequential indices", () => {
    expect(pages[0].sequence).toBe(0);
    expect(pages[1].sequence).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// listPages (v3)
// ---------------------------------------------------------------------------
describe("listPages — v3", () => {
  const pages = listPages(V3_MANIFEST);

  it("returns correct number of pages", () => {
    expect(pages.length).toBe(2);
  });

  it("extracts image URLs from v3 body structure", () => {
    expect(pages[0].imageUrl).toBe("https://example.com/image/1.jpg");
  });

  it("extracts thumbnail URLs", () => {
    expect(pages[0].thumbnailUrl).toBe("https://example.com/thumb/1.jpg");
    expect(pages[1].thumbnailUrl).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listPages — empty manifest
// ---------------------------------------------------------------------------
describe("listPages — empty manifest", () => {
  it("returns empty array without throwing", () => {
    const empty = { "@context": "...", "@type": "sc:Manifest", label: "Empty" } as unknown as IiifManifest;
    expect(listPages(empty)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// IIIF_INSTITUTIONS registry
// ---------------------------------------------------------------------------
describe("IIIF_INSTITUTIONS", () => {
  it("contains the three expected institutions", () => {
    expect(IIIF_INSTITUTIONS).toHaveProperty("e-codices");
    expect(IIIF_INSTITUTIONS).toHaveProperty("vatican");
    expect(IIIF_INSTITUTIONS).toHaveProperty("british-library");
  });

  it("each entry has required fields", () => {
    for (const inst of Object.values(IIIF_INSTITUTIONS)) {
      expect(inst.name).toBeTruthy();
      expect(inst.collectionUrl).toBeTruthy();
      expect(inst.approximateCount).toBeGreaterThan(0);
    }
  });
});
