# CodexAtlas — UX Guidelines

> **Design Reference Document**
> Version 1.0 · March 2026

---

## 1. Design Philosophy

### 1.1 Clarity Over Decoration

CodexAtlas presents dense, layered information — manuscripts, variants, translations, confidence scores, evidence chains, review histories. Every pixel must earn its place. If a visual element does not help the user locate, understand, or evaluate information, it is removed.

No decorative borders. No ornamental dividers. No gratuitous gradients. White space is the primary visual organizer. Typography and spacing do the heavy lifting.

### 1.2 Evidence Is the Interface

Transparency indicators — confidence badges, method badges, review status, version numbers, source counts, and "How do we know this?" links — are not supplementary metadata tucked into tooltips. They are the core experience.

A translation without its evidence context is incomplete. The interface must present evidence indicators as first-class elements, always visible, always accessible. A user should never encounter a claim, translation, or analysis without immediately seeing how confident the system is, how the result was produced, and how to inspect the full evidence chain.

### 1.3 Progressive Disclosure

The default view is simple and readable. Details are available on demand.

- **Level 0 — Glance:** Headline text, confidence badge color, method icon. Enough to scan.
- **Level 1 — Summary:** Confidence score as number, method label, review count, version number. One tap or click from Level 0.
- **Level 2 — Detail:** Full evidence record, version history timeline, all source manuscripts, all reviews. One more tap or click from Level 1.
- **Level 3 — Deep Dive:** Raw data, cross-references, export options, lineage context. Accessed through the Evidence Explorer.

Every element in the interface should be traceable through these four levels.

### 1.4 Respect Both Audiences

| | Research Surface (Scholars) | Exploration Surface (Public) |
|---|---|---|
| **Default density** | High — variant apparatus, confidence numbers, method details visible | Low — clean reading view, indicators subtle until tapped |
| **Vocabulary** | Technical — "variant cluster," "stemmatic position," "apparatus" | Plain language — "different versions," "manuscript family," "notes" |
| **Interaction** | Keyboard shortcuts, bulk operations, export tools | Touch-friendly, guided flows, "learn more" prompts |
| **Transparency depth** | All four levels immediately accessible | Level 0 and Level 1 visible; Level 2 and 3 behind "How do we know this?" |

### 1.5 Mobile-First, Desktop-Enhanced

Every layout is designed for a 360px-wide screen first. Tablet and desktop layouts add columns, expand panels, and increase information density — they never rearrange the core information hierarchy.

---

## 2. PWA Requirements

### 2.1 Installability

The app must be installable on all platforms via the browser's native install prompt.

**Web App Manifest (`manifest.json`):**

| Field | Value |
|---|---|
| `name` | CodexAtlas |
| `short_name` | CodexAtlas |
| `description` | AI-assisted research platform for ancient religious manuscripts |
| `start_url` | `/` |
| `display` | `standalone` |
| `orientation` | `any` |
| `theme_color` | `#1a365d` (deep blue) |
| `background_color` | `#fafaf9` (warm white) |
| `icons` | 192×192 PNG, 512×512 PNG, maskable versions of both |

The install prompt should be surfaced after the user has engaged with at least two manuscripts or spent 60+ seconds on the platform — not on first load.

### 2.2 Offline Reading

The service worker caches previously viewed content for offline access.

**What is cached offline:**
- Manuscript metadata and thumbnail images for any manuscript the user has viewed
- Full translation text for any translation the user has read
- The user's bookmarked/saved items
- Static UI assets (JS, CSS, fonts, icons)

**What is not cached offline:**
- High-resolution manuscript scans (too large; offer explicit download)
- Real-time review data
- Search index

**Offline indicator:** When the device is offline, a subtle banner appears at the top of the screen: "You're offline — showing saved content." Cached content renders normally. Uncached content shows a placeholder with "Available when online."

### 2.3 Push Notifications (Firebase Cloud Messaging)

Notifications are opt-in. The permission prompt appears only after the user has created an account and performed a meaningful action (submitted a review, bookmarked a manuscript, saved a translation).

**Notification types:**
- **Review updates** — "Your translation of Romans 5:1 received a new review"
- **Translation updates** — "A new version of 1 Corinthians 13 (P46) is available"
- **Discovery alerts** — "New manuscript added: Codex Vaticanus fragment"
- **Mention notifications** — "Dr. Chen referenced your review in their analysis"

Each notification deep-links to the relevant content.

### 2.4 Service Worker Caching Strategy

| Content Type | Strategy | Rationale |
|---|---|---|
| Static assets (JS, CSS, fonts, images) | **Cache-First** | Versioned by build hash; serve from cache, update in background |
| API data (reviews, user data, search) | **Network-First** | Must be fresh; fall back to cache when offline |
| Manuscript text and translations | **Stale-While-Revalidate** | Serve cached version immediately, fetch update in background; content changes infrequently |
| Manuscript images (thumbnails) | **Cache-First** | Images are immutable once uploaded |
| High-res manuscript scans | **Network-Only** | Too large to cache by default; user-initiated download for offline |

### 2.5 Performance Loading Targets

| Metric | Target (3G) | Target (Broadband) |
|---|---|---|
| Full interactive load | < 3 seconds | < 1 second |
| First Contentful Paint | < 1.5 seconds | < 0.5 seconds |
| Time to Interactive | < 3 seconds | < 1 second |

Achieved through: Next.js code splitting, edge delivery via Vercel, ISR for manuscript pages, lazy-loaded images, font subsetting, and aggressive service worker caching.

### 2.6 App-Like Navigation

- No full page reloads. All navigation uses Next.js client-side routing.
- Route transitions use a subtle 150ms fade to maintain spatial continuity.
- The browser back/forward buttons work correctly for all views, including modal states and panel expansions.
- Deep links work for every view — any URL can be shared and will render the correct state.

### 2.7 Splash Screen and Status Bar

- **Splash screen:** White background (`#fafaf9`) with the CodexAtlas wordmark centered. Displayed during app launch from home screen. Duration controlled by service worker boot time (target: < 500ms).
- **Status bar (mobile):** Themed to match the current surface. Research Surface: deep blue (`#1a365d`). Exploration Surface: warm white (`#fafaf9`) with dark text.
- **Dark mode:** Splash screen uses deep navy (`#0f172a`) with light wordmark. Status bar matches.

---

## 3. Mobile-First Design

### 3.1 Viewport Strategy

Base layout targets **320px–428px** viewport width (iPhone SE through iPhone Pro Max). All components must be fully functional at 320px. Nothing should horizontally overflow.

### 3.2 Touch Targets

- Minimum interactive target size: **44px × 44px** (per Apple HIG and WCAG 2.5.5)
- Minimum spacing between adjacent touch targets: **8px**
- Confidence badges, method badges, and all tappable indicators must meet this minimum even when visually compact — the tap area extends beyond the visual boundary if needed

### 3.3 Swipe Navigation

- **Passage browsing:** Swipe left/right to navigate between passages (chapters, verses) within the Scripture Explorer and Translation Viewer
- **Variant comparison (mobile):** Swipe left/right to switch between manuscript panels. A sticky diff summary bar remains visible at the top showing which manuscripts are being compared
- **Discoveries feed:** Swipe to dismiss/archive cards (with undo)
- Swipe gestures include a visible drag indicator (subtle line at top of swipeable content) and haptic feedback where supported

### 3.4 Bottom Navigation Bar (Mobile)

On mobile viewports (< 768px), primary navigation moves to a fixed bottom bar.

**Research Surface tabs:**
1. **Manuscripts** — manuscript browser
2. **Compare** — variant comparison view
3. **Translate** — translation workspace
4. **Reviews** — review queue and history

**Exploration Surface tabs:**
1. **Read** — scripture explorer
2. **Discover** — discoveries feed
3. **Library** — saved/bookmarked content
4. **Search** — global search

The bottom bar:
- Uses icons with text labels (icons alone are not accessible enough)
- Highlights the active tab with the primary color
- Hides on scroll-down, reappears on scroll-up (saves vertical space)
- Height: 56px plus safe area inset on notched devices

### 3.5 Responsive Breakpoints

| Breakpoint | Width | Layout |
|---|---|---|
| **Mobile** | < 768px | Single column. Bottom navigation. Collapsible panels. Full-width cards. |
| **Tablet** | 768px–1024px | Two-column where useful (e.g., source + translation side-by-side). Side navigation drawer. |
| **Desktop** | > 1024px | Multi-panel layouts (up to 4 columns for variant comparison). Persistent sidebar navigation. Hover interactions enabled. |

### 3.6 Collapsible Panels

On mobile, multi-panel views (variant comparison, translation workspace, evidence explorer) collapse into a single visible panel with a tab bar or swipe interface to switch between panels. The active panel is always full-width.

On tablet, two panels are visible simultaneously. On desktop, up to four.

### 3.7 Typography Sizing

| Role | Mobile | Tablet | Desktop |
|---|---|---|---|
| Body text | 16px | 16px | 16px |
| Large body (manuscript reading) | 18px | 18px | 18px |
| Small text (captions, metadata) | 14px | 14px | 14px |
| H4 | 20px | 20px | 20px |
| H3 | 24px | 26px | 28px |
| H2 | 28px | 30px | 32px |
| H1 | 32px | 34px | 36px |

Body text never drops below 16px on any viewport. Line height for reading text: 1.6. Line height for UI text: 1.4.

---

## 4. Transparency Indicators

This is the defining UX system of CodexAtlas. Every translation, analysis, and conclusion carries a set of transparency indicators that communicate trustworthiness, method, and evidence depth at a glance.

### 4.1 Confidence Badge

Displays the AI/human confidence score for a translation or analysis.

**Visual design:**
- Rounded rectangle, 28px height, variable width based on content
- Contains: colored dot (8px) + numeric score (e.g., "0.87") + optional label
- Background: semi-transparent tint of the confidence color
- Border: 1px solid at full confidence color

**Color scale:**

| Score Range | Color | Hex | Label |
|---|---|---|---|
| < 0.30 | Red | `#e53e3e` | Low confidence |
| 0.30–0.60 | Orange | `#dd6b20` | Moderate confidence |
| 0.60–0.80 | Yellow | `#d69e2e` | Good confidence |
| 0.80–0.95 | Green | `#38a169` | High confidence |
| > 0.95 | Blue | `#3182ce` | Very high confidence |

**Behavior:**
- Always visible on every translation block — never hidden, never optional
- Tappable: opens a detail panel showing the full confidence breakdown (which factors contributed to the score, how it changed across versions)
- On the Exploration Surface, the badge shows only the colored dot and a plain-language label ("High confidence") at Level 0. The numeric score appears at Level 1 on tap
- Includes a non-color indicator: the label text itself. Color-blind users can read "Low confidence" without relying on red

**Dark mode:** Colors are adjusted for luminance. The badge background becomes a darker tint; the text and border remain the same hue but at higher lightness.

### 4.2 Method Badge

Shows how the translation or analysis was produced.

**Methods:**

| Method | Icon | Color Accent | Description |
|---|---|---|---|
| AI Initial | Robot icon | Muted gray | First-pass AI translation, no human review |
| AI Revised | Robot + checkmark | Light blue | AI translation refined by additional AI passes |
| Human | Person icon | Primary blue | Translated or analyzed entirely by a human scholar |
| Hybrid | Robot + person | Warm gold | AI-initiated, human-edited or human-initiated with AI assistance |

**Visual design:**
- Pill shape, 28px height
- Icon (16px) + text label
- Outlined style (not filled) to avoid competing with the Confidence Badge for visual weight
- Positioned immediately after the Confidence Badge in the indicator row

**Behavior:**
- Tappable: shows method detail — which AI model (if applicable), which human (if applicable), timestamps
- On the Exploration Surface, the icon alone is shown at Level 0; the text label appears on tap

### 4.3 Review Status

Shows the current review state of a translation or analysis.

**States:**

| State | Icon | Visual Treatment |
|---|---|---|
| Unreviewed | Empty circle | Gray, dashed border |
| Under Review | Half-filled circle | Orange fill animation (subtle pulse) |
| Reviewed | Filled circle + checkmark | Green, solid |
| Disputed | Warning triangle | Red, solid |

**Additional indicators:**
- **Review count:** Small number badge on the review status icon (e.g., "3" for three completed reviews)
- **Consensus indicator:** When 3+ reviews exist, a small bar below the icon shows consensus level (filled proportionally). Full bar = unanimous agreement; partial bar = mixed reviews; minimal bar = significant disagreement

**Behavior:**
- Tappable: opens review summary panel showing all reviews, scores, and consensus analysis
- The "Disputed" state triggers a visual highlight on the entire translation block — a subtle red-tinted left border — to draw attention

### 4.4 Version Indicator

Shows the version number of the current translation or analysis.

**Visual design:**
- Compact text badge: "v3" in a rounded rectangle
- Muted styling (gray text, light background) — version is important metadata but should not dominate
- If a newer version exists, an orange dot appears next to the version number with tooltip: "Newer version available"

**Behavior:**
- Tappable: opens the Version History Timeline (see Section 9, VersionTimeline component)
- The timeline shows all versions with timestamps, authors, method changes, and confidence score progression

### 4.5 Source Indicator

Shows how many source manuscripts support a translation or analysis.

**Visual design:**
- Document stack icon + count number (e.g., "4 sources")
- Compact inline text, same row as other indicators

**Behavior:**
- Tappable: opens a list of source manuscripts with thumbnail, title, language, date, and archive
- Each source in the list links to the full manuscript view

### 4.6 "How Do We Know This?" Link

**This is the single most important UX element on the platform.**

Present on every translation block, every research conclusion, every AI-generated summary, and every analysis result. It is the gateway to the full evidence chain.

**Visual design:**
- Text link: "How do we know this?" in the secondary color (warm gold `#b7791f`)
- Underlined, with a small arrow icon (→)
- Positioned at the bottom of every translation block and every conclusion block
- Never hidden. Never collapsed. Never behind a menu.

**On the Research Surface:**
- Opens the Evidence Explorer (full-page view) showing the complete evidence chain: source manuscripts → OCR output → translation steps → AI model invocations → human reviews → confidence calculations → version history

**On the Exploration Surface:**
- Opens a simplified evidence summary: a plain-language explanation of how the translation was produced, followed by a "See full evidence" link to the Research Surface view

**Accessibility:**
- The link text is descriptive enough for screen readers without additional context
- It carries `aria-label="View evidence chain for this translation"`

### 4.7 Indicator Layout

All transparency indicators appear in a consistent row beneath the translation or analysis text they describe.

```
┌─────────────────────────────────────────────────────────┐
│  Translation text here. Lorem ipsum dolor sit amet,     │
│  consectetur adipiscing elit. Sed do eiusmod tempor     │
│  incididunt ut labore et dolore magna aliqua.           │
│                                                         │
│  ┌──────────┐ ┌───────────┐ ┌──┐ ┌──┐ ┌──────────┐    │
│  │ ● 0.87   │ │ 🤖 Hybrid │ │✓3│ │v3│ │ 📄 4 src │    │
│  └──────────┘ └───────────┘ └──┘ └──┘ └──────────┘    │
│                                                         │
│  How do we know this? →                                 │
└─────────────────────────────────────────────────────────┘
```

On mobile, this row wraps into two lines if needed. The "How do we know this?" link always occupies its own line.

---

## 5. Research Surface UX

### 5.1 Manuscript Browser

The primary entry point for scholars. Displays the full catalog of manuscripts in the system.

**Layout:**
- Toggle between **list view** (dense, scannable rows) and **grid view** (thumbnail cards)
- Default: list view on mobile (more efficient), grid view on desktop
- Persistent filter bar at top; sticky on scroll

**Filters:**
- Language (multi-select: Greek, Hebrew, Aramaic, Latin, Coptic, Syriac, etc.)
- Date range (slider with labeled century markers)
- Archive/collection (dropdown with search)
- Processing status (unprocessed, OCR complete, translated, reviewed)
- Has variants (boolean toggle)

**Sort options:**
- Date (oldest/newest)
- Title (alphabetical)
- Recently added
- Most reviewed
- Confidence score (average across translations)

**List view row:**
```
┌───────────────────────────────────────────────────────┐
│ 📜 Codex Sinaiticus (01)                    4th c. CE │
│ Greek · British Library · 743 pages                   │
│ ● 0.91 avg confidence · 12 translations · 47 reviews │
└───────────────────────────────────────────────────────┘
```

**Grid view card:**
```
┌─────────────────────┐
│ ┌─────────────────┐ │
│ │   [Thumbnail]   │ │
│ └─────────────────┘ │
│ Codex Sinaiticus    │
│ Greek · 4th c. CE   │
│ British Library     │
│ ● 0.91 · 12 trans  │
└─────────────────────┘
```

**Quick preview:** On desktop, hovering over a row/card for 500ms shows a popover with: first 200 characters of the manuscript description, provenance summary, and a "View manuscript →" link. On mobile, long-press triggers the same preview as a bottom sheet.

**Provenance summary card:** Displayed at the top of each manuscript's detail page. Shows: discovery location, discovery date, current archive, acquisition history, and physical description (material, dimensions, condition). Sourced from manuscript metadata.

### 5.2 Variant Comparison View

Side-by-side display of 2–4 manuscripts for textual comparison.

**Desktop layout (2 panels shown, up to 4 supported):**
```
┌──────────────────────────┬──────────────────────────┐
│ Codex Sinaiticus (01)    │ Codex Vaticanus (03)     │
│ 4th c. · Greek           │ 4th c. · Greek           │
├──────────────────────────┼──────────────────────────┤
│ ἐν ᾧ [δικαιωθέντες]     │ ἐν ᾧ [δικαιωθέντες]     │
│ ██ ἔχομεν εἰρήνην       │ ██ ἔχωμεν εἰρήνην       │
│ πρὸς τὸν θεὸν           │ πρὸς τὸν θεὸν           │
├──────────────────────────┴──────────────────────────┤
│ Diff: ἔχομεν (indicative) ↔ ἔχωμεν (subjunctive)   │
│ Variant type: Orthographic · Confidence: 0.94        │
└─────────────────────────────────────────────────────┘
```

**Features:**
- **Synchronized scrolling:** All panels scroll together. Togglable — scholars may want independent scrolling for non-aligned passages.
- **Word-level diff highlighting:** Words that differ between manuscripts are highlighted with a background color. Identical text is unhighlighted.
- **Color-coded variant types:**
  - Blue highlight: orthographic variant (spelling difference)
  - Orange highlight: lexical variant (different word)
  - Red highlight: omission/addition (text present in one, absent in another)
  - Purple highlight: word order difference
- **Apparatus notes:** Collapsible panel below each passage with scholarly notes on the variant (significance, frequency in manuscript tradition, previous scholarly commentary)
- **Panel management:** Add/remove panels via a toolbar. Each panel has a manuscript selector dropdown.

**Mobile layout:**
- Single panel visible at a time, full-width
- Swipe left/right to switch between manuscripts
- Sticky diff summary bar at top: "Comparing: Sinaiticus ↔ Vaticanus · 3 variants in view"
- Tap the diff summary bar to expand a condensed diff list showing all variants in the current passage

### 5.3 Translation Workspace

The primary authoring and review environment for translations.

**Three-panel layout (desktop):**
```
┌──────────────┬──────────────────┬──────────────┐
│ Source Text   │ Translation       │ Evidence     │
│              │                   │              │
│ Original     │ Current version   │ Evidence     │
│ language     │ with transparency │ record,      │
│ text with    │ indicators        │ version      │
│ apparatus    │                   │ history,     │
│ notes        │ Version selector  │ reviews      │
│              │ (v1, v2, v3...)   │              │
│              │                   │ Review       │
│              │                   │ submission   │
│              │                   │ form         │
└──────────────┴──────────────────┴──────────────┘
```

**Source text panel (left):**
- Original language text with line numbers
- Rendered in the monospace font for precise character alignment
- Apparatus notes inline (togglable) or in a footnote bar
- Word-level selection: tap a word to see parsing, dictionary entry, and variant information

**Translation panel (center):**
- The current translation version, rendered in the serif reading font
- Version selector dropdown at the top: switch between all versions
- Full transparency indicator row below the text
- Editable when the user has translation permissions: inline editing with change tracking

**Evidence sidebar (right, or bottom sheet on mobile):**
- Full evidence record for the current translation
- Version history timeline (vertical, most recent at top)
- All reviews listed with score, summary, and reviewer
- Review submission form: structured fields for accuracy (1-5), clarity (1-5), evidence support (1-5), free-text critique, and an approve/request-changes/dispute action

### 5.4 Lineage Visualization

Interactive stemma (tree diagram) showing hypothesized manuscript descent and relationships.

**Visual design:**
- Tree/graph layout with manuscripts as nodes and relationships as edges
- **Node:** Rounded rectangle containing manuscript siglum (e.g., "01"), date, and language. Color-coded by textual family.
- **Edge:** Line connecting parent to child manuscript. Line thickness proportional to confidence score. Dashed line for hypothesized (low confidence) relationships, solid for established ones.
- **Confidence score label:** Small text on each edge showing the relationship confidence (e.g., "0.82")
- Hypothetical manuscripts (inferred ancestors not physically extant) shown as dashed-border nodes

**Interactions:**
- **Zoom and pan:** Scroll to zoom, drag to pan. Pinch-to-zoom on touch devices.
- **Click node:** Opens a detail card beside the node showing manuscript summary, link to full view
- **Click edge:** Opens relationship detail: confidence score, evidence, method of determination
- **Filter:** Toggle to show/hide hypothetical nodes, filter by confidence threshold, filter by textual family
- **Export:** Download as SVG or PNG image for publication

**Mobile adaptation:** The tree renders in a simplified vertical layout. Nodes are stacked with indentation showing hierarchy. Tap to expand/collapse branches.

### 5.5 Evidence Explorer

Full-page view of the complete evidence chain for any translation or analysis.

**Structure:**
```
Evidence Chain for Romans 5:1 (Translation v3)
═══════════════════════════════════════════════

Source Manuscripts (4)
  └─ Codex Sinaiticus → [view]
  └─ Codex Vaticanus → [view]
  └─ P46 → [view]
  └─ Codex Alexandrinus → [view]

OCR Processing
  └─ Model: Tesseract + custom Greek model
  └─ Confidence: 0.96
  └─ Processed: 2026-02-14

AI Translation (v1)
  └─ Model: Claude 3.5 Sonnet
  └─ Prompt: [view prompt]
  └─ Output confidence: 0.74
  └─ Generated: 2026-02-15

Human Review (v2)
  └─ Reviewer: Dr. Sarah Chen
  └─ Changes: 12 word modifications
  └─ New confidence: 0.88
  └─ Reviewed: 2026-02-18

AI Refinement (v3)
  └─ Model: Claude 3.5 Sonnet
  └─ Input: v2 + reviewer notes
  └─ Output confidence: 0.91
  └─ Generated: 2026-02-19

Reviews (3)
  └─ Review 1: 4.5/5.0 — Approved ✓
  └─ Review 2: 4.0/5.0 — Approved ✓
  └─ Review 3: 3.5/5.0 — Changes requested
```

**Navigation:**
- Breadcrumb trail at top: Manuscript → Passage → Translation → Evidence
- Each evidence node is expandable inline or linkable to its full detail view
- Cross-reference links: if a source manuscript has its own evidence chain, link to it
- Filter by evidence type: manuscripts, AI processing, human reviews, all

---

## 6. Exploration Surface UX

### 6.1 Scripture Explorer

The primary reading interface for the public audience.

**Navigation hierarchy:** Book → Chapter → Verse

**Navigation UI:**
- **PassageNavigator component** at top of page: three linked dropdowns (Book, Chapter, Verse)
- On mobile, these collapse into a single tap target showing the current reference (e.g., "Romans 5:1") that opens a full-screen navigator with scrollable book/chapter/verse columns
- Swipe left/right to move between passages (chapters or verse ranges, depending on user preference)

**Reading view:**
- Clean, distraction-free layout. Serif font (Literata). Generous margins and line spacing.
- Translation selector: dropdown at top-right showing available translations. Default: highest-confidence translation.
- Transparency indicators appear as a subtle row beneath each passage — colored confidence dot, method icon, and version number. Not overwhelming, but visible.
- **"Tap to learn more" pattern:** Tapping anywhere on the transparency indicator row expands it to show the full indicator set plus the "How do we know this?" link
- **Reading progress:** A thin progress bar at the very top of the screen shows position within the current book. Reading position is saved and restored across sessions.

### 6.2 Translation Viewer

Focused view for reading and comparing translations of a specific passage.

**Primary view:**
- Large, readable translation text (serif font, 18px)
- Translator/method attribution below the text
- Transparency indicators in the standard row
- "How do we know this?" link

**Comparison mode:**
- Activated via a "Compare translations" button
- Side-by-side layout (desktop) or swipe-to-switch (mobile) showing two translations
- Differences highlighted with a subtle background color
- Each side carries its own transparency indicators

**Notes and commentary:**
- Expandable section below the translation
- Contains scholarly notes, cross-references, and historical context
- AI-generated summaries are clearly labeled with a Method Badge ("AI Summary")

### 6.3 Discoveries Feed

A curated stream of notable manuscript discoveries, new translations, and research updates.

**Layout:**
- Card-based vertical feed
- **Featured discovery:** Large hero card at top with image, headline, summary, and "Read more" link
- **Standard cards:** Thumbnail (left) + headline + category tag + date + summary (2 lines)
- **Category tags:** "New Manuscript" (blue), "New Translation" (green), "Research Update" (gold), "Community" (purple)

**Card anatomy:**
```
┌─────────────────────────────────────────────┐
│ ┌────────┐                                  │
│ │ [img]  │  New Manuscript                  │
│ │        │  Newly digitized fragment of      │
│ └────────┘  Gospel of Thomas identified      │
│             Mar 7, 2026 · 3 min read         │
│             [Save] [Share]                   │
└─────────────────────────────────────────────┘
```

**Features:**
- Share button: native share sheet on mobile, copy-link on desktop
- Save/bookmark: heart icon; saved items appear in the Library tab and are cached for offline reading
- Infinite scroll with skeleton loading states
- Pull-to-refresh on mobile

### 6.4 Research Summaries

Plain-language summaries of scholarly research for public consumption.

**Design:**
- Clean article layout with generous white space
- Headline, author attribution, date, estimated read time
- AI-generated summaries carry a visible Method Badge and a "How do we know this?" link explaining the summarization method
- **Visual aids:** Embedded timelines (horizontal scrollable), maps (interactive, showing manuscript discovery locations), and simplified lineage diagrams
- **"Read the full research" link** at the bottom, linking to the Research Surface for scholars who want depth

---

## 7. Color System

### 7.1 Core Palette

| Role | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| **Primary** | `#1a365d` (deep blue) | `#63b3ed` (light blue) | Navigation, primary actions, active states, headings |
| **Secondary** | `#b7791f` (warm gold) | `#ecc94b` (bright gold) | "How do we know this?" links, discovery accents, secondary actions |
| **Background** | `#fafaf9` (warm white) | `#0f172a` (deep navy) | Page background |
| **Surface** | `#ffffff` | `#1e293b` (slate 800) | Cards, panels, elevated content |
| **Text primary** | `#1a1a2e` (near-black) | `#e2e8f0` (slate 200) | Body text, headings |
| **Text secondary** | `#4a5568` (gray 600) | `#a0aec0` (gray 400) | Metadata, captions, secondary labels |
| **Border** | `#e2e8f0` (slate 200) | `#334155` (slate 700) | Dividers, card borders, input borders |

### 7.2 Confidence Colors

These colors are consistent across light and dark modes, with luminance adjustments for dark backgrounds:

| Score | Light Mode | Dark Mode | Label |
|---|---|---|---|
| < 0.30 | `#e53e3e` | `#fc8181` | Low |
| 0.30–0.60 | `#dd6b20` | `#f6ad55` | Moderate |
| 0.60–0.80 | `#d69e2e` | `#ecc94b` | Good |
| 0.80–0.95 | `#38a169` | `#68d391` | High |
| > 0.95 | `#3182ce` | `#63b3ed` | Very high |

### 7.3 Variant Diff Colors

| Variant Type | Light Background | Dark Background |
|---|---|---|
| Orthographic | `#ebf8ff` (blue 50) | `#2a4365` (blue 800) |
| Lexical | `#fffaf0` (orange 50) | `#652b19` (orange 900) |
| Omission/Addition | `#fff5f5` (red 50) | `#63171b` (red 900) |
| Word order | `#faf5ff` (purple 50) | `#44337a` (purple 800) |

### 7.4 Dark Mode

Dark mode is supported from launch. It is not an afterthought.

- Toggled via a sun/moon icon in the top navigation bar
- Respects the system-level `prefers-color-scheme` preference by default
- User choice persists in local storage and overrides system preference
- All text meets WCAG AA contrast ratios against dark backgrounds
- Confidence badge colors are lightened (see dark mode column above) to maintain legibility
- Manuscript images are displayed at original colors (no filter); the surrounding UI adapts

---

## 8. Typography

### 8.1 Font Stack

| Role | Font | Fallback | Usage |
|---|---|---|---|
| **UI (primary)** | Inter | system-ui, -apple-system, sans-serif | Navigation, buttons, labels, metadata, form inputs, badges |
| **Reading (secondary)** | Literata | Georgia, serif | Manuscript text, translation passages, extended reading, research summaries |
| **Monospace** | JetBrains Mono | Menlo, Consolas, monospace | Original language text, technical data, code references, API responses |

### 8.2 Type Scale

| Token | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| `text-xs` | 12px | 400 | 1.4 | Badges, timestamps, fine print |
| `text-sm` | 14px | 400 | 1.4 | Captions, metadata, secondary labels |
| `text-base` | 16px | 400 | 1.6 | Body text, form inputs, default |
| `text-lg` | 18px | 400 | 1.6 | Large body, manuscript reading text |
| `text-xl` | 20px | 600 | 1.3 | H4, card titles, section labels |
| `text-2xl` | 24px | 600 | 1.3 | H3, panel headings |
| `text-3xl` | 30px | 700 | 1.2 | H2, page section headings |
| `text-4xl` | 36px | 700 | 1.1 | H1, page titles |

### 8.3 Font Loading Strategy

- Inter and Literata are loaded via `next/font` with `display: swap` to prevent FOIT (flash of invisible text)
- Only the Latin and Greek Unicode ranges are loaded initially; Hebrew, Aramaic, Coptic, and Syriac ranges are loaded on demand when manuscripts in those languages are viewed
- Font files are self-hosted (not loaded from Google Fonts CDN) for privacy and performance consistency

---

## 9. Component Patterns

### 9.1 ManuscriptCard

Displays a manuscript summary in the browser and search results.

**Props:** `thumbnail`, `title`, `siglum`, `language`, `date`, `archive`, `pageCount`, `avgConfidence`, `translationCount`, `reviewCount`

**Visual anatomy:**
```
┌─────────────────────────────────┐
│ ┌───────┐  Codex Sinaiticus     │
│ │ thumb │  (01) · Greek          │
│ │       │  4th century CE        │
│ └───────┘  British Library       │
│            743 pp · ● 0.91 avg   │
│            12 translations       │
└─────────────────────────────────┘
```

- Thumbnail: 80×100px, rounded corners (4px), object-fit cover. Placeholder skeleton if loading.
- Title in `text-xl` weight 600. Siglum in parentheses, muted color.
- Metadata in `text-sm`, secondary text color.
- Confidence badge (compact variant): colored dot + score only.
- Entire card is a link to the manuscript detail page.

### 9.2 TranslationBlock

Displays a translation passage with its full transparency indicator set.

**Props:** `text`, `confidence`, `method`, `reviewStatus`, `reviewCount`, `version`, `sourceCount`, `passageRef`

**Layout:**
- Translation text in serif font (`text-lg`), generous line height (1.6)
- Below text: indicator row containing ConfidenceBadge, MethodBadge, ReviewStatus, VersionIndicator, SourceIndicator
- Below indicators: "How do we know this?" link
- Optional bottom border or subtle card container depending on context

### 9.3 ConfidenceBadge

**Props:** `score`, `size` (`sm` | `md`), `showLabel`

- `sm`: colored dot (8px) + score only. Used inline in dense contexts (ManuscriptCard, tables).
- `md`: colored dot + score + label text ("High confidence"). Default size.
- Badge uses `role="status"` and `aria-label="Confidence score: 0.87, High confidence"` for screen readers.

### 9.4 MethodBadge

**Props:** `method` (`ai-initial` | `ai-revised` | `human` | `hybrid`)

- Pill shape with outlined border
- Icon (16px SVG) + label text
- Tappable to expand method details
- `aria-label="Translation method: Hybrid (AI-initiated, human-edited)"`

### 9.5 ReviewCard

Displays a single review in the review list.

**Props:** `reviewer`, `date`, `accuracyScore`, `clarityScore`, `evidenceScore`, `overallScore`, `summary`, `action` (`approved` | `changes-requested` | `disputed`)

**Layout:**
```
┌─────────────────────────────────────────────┐
│ Dr. Sarah Chen · Mar 18, 2026               │
│ ★★★★½ (4.5/5.0) · Approved ✓               │
│                                             │
│ "Strong translation that captures the       │
│  subjunctive mood accurately. Minor         │
│  quibble with 'peace' vs 'reconciliation'." │
│                                             │
│ Accuracy: 5 · Clarity: 4 · Evidence: 4.5   │
└─────────────────────────────────────────────┘
```

- Action state indicated by color: Approved (green), Changes requested (orange), Disputed (red)
- Reviewer name is a link to their profile

### 9.6 VersionTimeline

Horizontal (desktop) or vertical (mobile) timeline showing all versions of a translation.

**Props:** `versions[]` — array of `{ version, date, author, method, confidence, changesSummary }`

**Desktop (horizontal):**
```
v1 ────── v2 ────── v3 (current)
AI Init   Human     AI Revised
0.74      0.88      0.91
Feb 15    Feb 18    Feb 19
```

**Mobile (vertical):**
```
● v3 (current) — Feb 19
  AI Revised · 0.91
  "Refined based on reviewer feedback"

● v2 — Feb 18
  Human · 0.88
  "12 word modifications by Dr. Chen"

● v1 — Feb 15
  AI Initial · 0.74
  "Initial AI translation from source"
```

Each node is tappable to view that version's full text and evidence record.

### 9.7 VariantDiffView

Side-by-side text comparison with highlighted differences.

**Props:** `manuscripts[]` (2–4), `passageRef`, `syncScroll`

- Each panel is independently scrollable (when `syncScroll` is off) or synchronized
- Diff words highlighted with variant-type colors (see Section 7.3)
- Non-differing text rendered at reduced opacity (0.7) to emphasize differences
- Panel header shows manuscript name, date, and language
- Collapsible apparatus panel below each column

### 9.8 EvidenceChain

Linked visualization of the full evidence record.

**Props:** `steps[]` — array of evidence steps with type, content, timestamp, and links

- Rendered as a vertical chain of connected cards
- Each card has a type icon (manuscript, AI, human, review), summary text, timestamp, and "View details" link
- Cards are connected by a vertical line on the left margin
- Expandable inline: clicking a card expands it to show full details without leaving the page

### 9.9 PassageNavigator

Book → Chapter → Verse selector for navigating scripture.

**Props:** `books[]`, `currentBook`, `currentChapter`, `currentVerse`, `onChange`

**Desktop:** Three linked dropdowns in a horizontal row.

**Mobile:** Single button showing current reference (e.g., "Romans 5:1"). Tapping opens a full-screen bottom sheet with three scrollable columns (book, chapter, verse) — similar to iOS date picker interaction. Selecting a value in the left column updates the options in the right columns.

---

## 10. Accessibility

### 10.1 Compliance Target

WCAG 2.1 Level AA across all surfaces. Level AAA for text contrast on the reading view (7:1 ratio for body text).

### 10.2 Semantic HTML

- All pages use proper landmark elements: `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`
- Headings follow a strict hierarchy — no skipped levels
- Lists use `<ul>`, `<ol>`, `<dl>` appropriately
- Tables use `<th>` with `scope` attributes
- Forms use `<label>` elements linked to inputs via `for`/`id`

### 10.3 ARIA

- Interactive custom components carry appropriate ARIA roles (`role="tab"`, `role="tabpanel"`, `role="dialog"`, `role="status"`)
- Live regions (`aria-live="polite"`) announce dynamic content changes: new reviews, confidence score updates, version changes
- Loading states use `aria-busy="true"` on the updating region
- Modals trap focus and return focus to the triggering element on close
- Expandable sections use `aria-expanded` and `aria-controls`

### 10.4 Keyboard Navigation

- All interactive elements are reachable via Tab in a logical order
- Custom focus indicators: 2px solid ring in the primary color with 2px offset. Never removed, never `outline: none`.
- Escape closes modals, popovers, and expanded panels
- Arrow keys navigate within tab bars, dropdowns, and the passage navigator
- Research Surface keyboard shortcuts (togglable, documented in a help modal accessed via `?`):
  - `n` / `p` — next/previous passage
  - `v` — open variant comparison
  - `e` — open evidence explorer
  - `r` — open review form
  - `1`–`4` — switch between panels

### 10.5 Screen Readers

- All images have meaningful `alt` text. Manuscript thumbnails: "Thumbnail of [manuscript title], [language], [date]"
- Confidence badges: `aria-label="Confidence score: 0.87, High confidence"`
- Method badges: `aria-label="Translation method: Hybrid"`
- Icon-only buttons always carry `aria-label`
- Diff highlights in variant comparison: use `<ins>` and `<del>` elements with `aria-label` for additions and removals
- The "How do we know this?" link needs no additional ARIA — its text is self-describing

### 10.6 Color Independence

Every piece of information conveyed by color is also conveyed by text, icon, or pattern:
- Confidence: color + numeric score + text label
- Variant type: color + icon + label in the apparatus
- Review status: color + icon (shape differs per state) + text label
- Version updates: orange dot + "Newer version available" tooltip text

### 10.7 Reduced Motion

When `prefers-reduced-motion: reduce` is detected:
- All transitions are instantaneous (duration: 0ms)
- No animated loading states (use static skeleton placeholders)
- No scroll-linked animations
- Review status pulse animation is disabled
- Page transitions are instant cuts, no fades

### 10.8 Contrast Ratios

| Element | Light Mode | Dark Mode | Minimum |
|---|---|---|---|
| Body text on background | 15.4:1 | 13.2:1 | 4.5:1 (AA) |
| Reading text (serif) on background | 15.4:1 | 13.2:1 | 7:1 (AAA target) |
| Secondary text on background | 7.1:1 | 6.3:1 | 4.5:1 (AA) |
| Large headings on background | 15.4:1 | 13.2:1 | 3:1 (AA) |
| Badge text on badge background | Verified per color | Verified per color | 4.5:1 (AA) |

---

## 11. Performance Targets

### 11.1 Lighthouse Scores

| Category | Target |
|---|---|
| Performance | > 90 |
| Accessibility | > 95 |
| Best Practices | > 95 |
| SEO | > 90 |
| PWA | Pass all checks |

### 11.2 Core Web Vitals

| Metric | Target | Measurement Condition |
|---|---|---|
| First Contentful Paint (FCP) | < 1.5s | Mobile, 3G throttled |
| Largest Contentful Paint (LCP) | < 2.5s | Mobile, 3G throttled |
| Cumulative Layout Shift (CLS) | < 0.1 | Full page load + 5s idle |
| First Input Delay (FID) | < 100ms | Mobile, real user monitoring |
| Interaction to Next Paint (INP) | < 200ms | P75 of all interactions |
| Time to Interactive (TTI) | < 3s | Mobile, 3G throttled |

### 11.3 Bundle Budget

| Chunk | Maximum Size (gzipped) |
|---|---|
| Initial JS (critical path) | < 80KB |
| Total initial JS (all chunks loaded on first page) | < 200KB |
| Per-route lazy chunk | < 50KB |
| CSS (critical) | < 15KB |
| Total CSS | < 50KB |
| Fonts (initial load) | < 100KB (Latin + Greek subsets only) |

### 11.4 Image Optimization

- All manuscript thumbnails served as WebP with AVIF fallback
- Responsive `srcset` with breakpoints at 160w, 320w, 640w, 1280w
- Lazy loading via `loading="lazy"` for all images below the fold
- Blur-up placeholder (10px wide base64-encoded) for manuscript images during load
- High-resolution scans served on demand only, never eagerly loaded

### 11.5 Monitoring

- Real User Monitoring (RUM) via Vercel Analytics for Core Web Vitals
- Synthetic monitoring: weekly Lighthouse CI runs against staging
- Bundle size checked in CI — builds that exceed budget fail

---

## 12. Animation and Interaction

### 12.1 Transition Defaults

| Context | Duration | Easing | Property |
|---|---|---|---|
| UI state change (hover, focus, active) | 200ms | ease-out | background-color, border-color, box-shadow |
| Panel expand/collapse | 250ms | ease-in-out | height, opacity |
| Page/route transition | 150ms | ease-out | opacity |
| Modal open | 200ms | ease-out | opacity, transform (scale 0.95 → 1.0) |
| Modal close | 150ms | ease-in | opacity, transform (scale 1.0 → 0.95) |
| Bottom sheet slide | 300ms | cubic-bezier(0.32, 0.72, 0, 1) | transform (translateY) |
| Toast notification | 300ms in, 200ms out | ease-out / ease-in | transform (translateY), opacity |

### 12.2 Loading States

- **Content areas:** Skeleton screens matching the expected layout shape. Gray pulsing rectangles for text lines, rounded rectangles for images. Never use spinners for content loading.
- **Actions (buttons, form submissions):** Inline loading indicator within the button (small spinner replacing button text). Button disabled during loading.
- **Full-page loading:** Only during initial app boot from home screen (splash screen). Never during in-app navigation.
- **Progressive loading:** For manuscript images, show blur-up placeholder → low-res → full-res. For long text, show first paragraph immediately, load rest with skeleton.

### 12.3 Scroll-Linked Animation

Used sparingly and only for non-essential engagement:
- **Reading progress bar:** Thin bar at very top of viewport, width tracks scroll position through current book/chapter. CSS-only via `scroll-timeline` where supported, falls back to IntersectionObserver.
- **Parallax on hero cards:** Discoveries feed hero card image has subtle parallax (< 10px travel). Disabled when `prefers-reduced-motion` is set.
- No scroll-linked animations on core research or reading views.

### 12.4 Micro-interactions

- **Confidence badge tap:** Scale to 1.05 for 100ms, then back. Provides satisfying feedback when expanding the evidence detail.
- **Bookmark/save toggle:** Heart icon fills with a quick scale-up (1.0 → 1.2 → 1.0 over 300ms).
- **Review submission:** Checkmark draw animation (SVG path animation, 400ms). Conveys successful submission clearly.
- **Version switch:** Translation text cross-fades between versions (200ms) — no layout shift.

### 12.5 Respecting `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

This is applied globally. No animation or transition runs when the user has requested reduced motion. Skeleton loading placeholders display as static gray rectangles (no pulse).

---

## Appendix A: Design Tokens Summary

For implementation in CSS custom properties or a design token system (e.g., Tailwind config):

```
/* Colors — Light Mode */
--color-primary:         #1a365d;
--color-secondary:       #b7791f;
--color-bg:              #fafaf9;
--color-surface:         #ffffff;
--color-text-primary:    #1a1a2e;
--color-text-secondary:  #4a5568;
--color-border:          #e2e8f0;

/* Colors — Dark Mode */
--color-primary-dark:        #63b3ed;
--color-secondary-dark:      #ecc94b;
--color-bg-dark:             #0f172a;
--color-surface-dark:        #1e293b;
--color-text-primary-dark:   #e2e8f0;
--color-text-secondary-dark: #a0aec0;
--color-border-dark:         #334155;

/* Confidence Colors */
--color-confidence-low:      #e53e3e;
--color-confidence-moderate:  #dd6b20;
--color-confidence-good:     #d69e2e;
--color-confidence-high:     #38a169;
--color-confidence-very-high: #3182ce;

/* Typography */
--font-ui:       'Inter', system-ui, -apple-system, sans-serif;
--font-reading:  'Literata', Georgia, serif;
--font-mono:     'JetBrains Mono', Menlo, Consolas, monospace;

/* Spacing */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;

/* Radii */
--radius-sm:   4px;
--radius-md:   8px;
--radius-lg:   12px;
--radius-full: 9999px;

/* Shadows (Light Mode) */
--shadow-sm:  0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md:  0 4px 6px rgba(0, 0, 0, 0.07);
--shadow-lg:  0 10px 15px rgba(0, 0, 0, 0.1);

/* Transitions */
--transition-fast: 150ms ease-out;
--transition-base: 200ms ease-out;
--transition-slow: 300ms ease-in-out;

/* Z-Index Scale */
--z-dropdown:     10;
--z-sticky:       20;
--z-overlay:      30;
--z-modal:        40;
--z-toast:        50;
--z-tooltip:      60;

/* Breakpoints (for reference; use in media queries) */
--bp-tablet:  768px;
--bp-desktop: 1024px;
--bp-wide:    1280px;
```

---

## Appendix B: Implementation Checklist

Use this checklist when building new features to ensure compliance with these guidelines.

- [ ] Transparency indicators present on every translation and analysis output
- [ ] "How do we know this?" link present and functional
- [ ] Confidence badge with correct color, score, and label
- [ ] Method badge with correct icon and label
- [ ] All touch targets ≥ 44×44px
- [ ] Layout functional at 320px viewport width
- [ ] Dark mode tested and correct
- [ ] Color is never the only indicator for any information
- [ ] Keyboard navigation functional (Tab, Escape, Arrow keys)
- [ ] Screen reader announces all interactive elements correctly
- [ ] Skeleton loading states (no spinners for content)
- [ ] `prefers-reduced-motion` respected
- [ ] Fonts load with `display: swap`
- [ ] Images lazy-loaded below the fold
- [ ] Lighthouse Performance score > 90
- [ ] Bundle size within budget
- [ ] Offline behavior tested (cached content renders, uncached shows placeholder)
