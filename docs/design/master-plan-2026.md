# CodexAtlas — Master Development Plan
**Last Updated:** 2026-03-19
**Status:** Active — Phase 5 queued for execution
**Supersedes:** `docs/design/phase4-strategic-roadmap-2026.md`, `docs/design/ingestion-rework-2026.md`

---

## 1. Completed Work (Phases 1–4)

### Phase 1 — Foundation (complete)
Database schema, RLS, Supabase Auth, manuscript CRUD, passage creation, AI translation via Claude with evidence records, version history, human review, variant comparison.

### Phase 2 — Research Pipeline (complete)
Translation workspace with parallel text, evidence panel, version history, review workflow, variant detection, batch translation, export, OCR pipeline.

### Phase 3 — Ingestion Rework (complete)
- Replaced 6-step AI fallback import chain with clean 3-tier system: Source Registry → NTVMR API → `no_source`
- Source registry: Sinaiticus, DSS/ETCBC, WLC, SBLGNT, THGNT, Coptic Scriptorium, OSHB, OpenGreekAndLatin
- CLI preprocessor scripts per corpus (no AI in import chain)
- Mismatch warning banner + re-import button in text provenance
- IIIF harvest panel for institutional manuscript metadata
- Registry admin panel with import status + row counts (pagination fix: 1000-row cap bypass)
- Migrations 020–026 applied

### Phase 4 — Translation Reliability + Corpus Browser + Summary Pyramid (complete)

**Sprint 4.1 — Translation Reliability**
- [x] Tool use structured output (`submit_translation` tool) — parse failures impossible
- [x] Model update → `claude-sonnet-4-6`
- [x] Exponential backoff (max 3 retries, jitter, 500/502/503/529 retried)
- [x] `maxDuration` 60 → 300s; AbortController 50s → 270s
- [x] Migration 028: `create_translation_version_with_evidence` RPC (atomic DB writes)
- [ ] Resumable batch — **OUTSTANDING** (described below)

**Sprint 4.1b — Atomic DB Writes (this session)**
- [x] Migrate translate route to use RPC — no more orphaned evidence records
- [x] Upgrade `summaries/passage/route.ts` to tool use

**Sprint 4.2 — Compare View**
- [x] Word-level diff between translations (`computeWordDiff`)
- [x] Confidence badges per manuscript
- [x] Translation notes + key decisions (collapsible)
- [x] Evidence record metadata wired to compare UI

**Sprint 4.3 — Summary Pyramid**
- [x] Migration 027: `ai_summaries` table (`level`, `scope_key`, `content JSONB`, UNIQUE)
- [x] `POST /api/summaries/chapter` — Haiku, tool use, cached
- [x] `POST /api/summaries/book` — Sonnet, tool use, cached, requires chapters first
- [x] `POST /api/summaries/grand` — Opus, admin/editor only, tool use
- [x] `POST /api/summaries/manuscript` — Haiku
- [x] `ChapterSummary` component in read view
- [x] Book overview page `/read/[book]` — chapter grid, summary panel, bulk chapter generate
- [x] Bulk book summary trigger in corpus browser (per visible tab)
- [x] `/insights` page — grand assessment + book summary cards
- [x] `/about/sources` attribution page with license badges
- [x] Footer with attribution link

**Sprint 4.4 — Docs**
- [x] `ROADMAP.md` updated
- [x] `DEVELOPMENT_LOG.md` entries for 4.1b, 4.2, 4.3

---

## 2. Outstanding Phase 4 Items

These are small, low-priority items from the Phase 4 plan not yet executed.

### 4.1 Resumable batch
**File:** `app/src/app/(main)/admin/batch-translate-panel.tsx`
**Effort:** 1 hr
Store current job state `{ manuscriptId, language }` in `sessionStorage`. Add "Resume" button that re-runs the scan and starts from the first untranslated passage. The batch scan already skips translated passages — just needs a UI entry point.

### 4.3 Cross-manuscript summary
**File:** `app/src/app/api/summaries/cross-manuscript/route.ts` (new)
**Effort:** 1 day
Aggregates all chapter summaries + variant data across manuscripts for the same book+chapter. Sonnet model. Deferred until more manuscripts are loaded and variant detection has been run broadly. Not worth building until there's meaningful multi-manuscript data.

### 4.3 Manuscript summary → tool use upgrade
**File:** `app/src/app/api/summaries/manuscript/route.ts`
**Effort:** 30 min
Currently uses direct text response (JSON-in-prompt). Upgrade to tool use like all other summary routes. Minor but keeps the codebase consistent.

---

## 3. Phase 5 — Contributor System

### 3.1 Goal

Let trusted friends and collaborators join the platform with full AI task access (discover, import, translate, batch, summarize, variant detection) using **their own Anthropic API key** — not the platform key. Admin approves who can contribute. Contributors can delete only their own work (with version revert). No billing infrastructure needed.

### 3.2 Role Hierarchy

```
reader           — public read-only (default on signup)
reviewer         — can submit human reviews on existing translations
scholar          — can translate (POST /api/translate only)
contributor      — full AI task access; uses own Anthropic API key; restricted delete
editor           — full AI task access; uses platform key; no user management
admin            — everything + user approval + unrestricted delete
pending_contributor — applied for contributor, awaiting admin approval (reader-level access)
```

`contributor` is added to all `ADMIN_ROLES` arrays across the codebase (currently `["admin", "editor"]` in ~14 routes). The only differences from `editor`:
- Uses their personal Anthropic API key (decrypted from Supabase Vault) instead of `process.env.ANTHROPIC_API_KEY`
- If no key stored → 402 response with link to Settings
- Can only soft-delete translation versions they created (with version revert)
- Cannot access the Users management tab in the admin panel

### 3.3 Funding — Supabase Vault API Key Pass-Through

**Why Vault (Option B):** Supabase Vault (`pgsodium`) is included in the Pro plan at no extra cost. Keys are encrypted at the DB layer — the plaintext never leaves Postgres — which is safer than application-level AES where the server process holds the key material.

**How it works:**
1. Contributor enters their Anthropic API key in `/settings`
2. `POST /api/settings/api-key` calls `admin.rpc('store_contributor_api_key', { p_user_id, p_api_key })`
3. PL/pgSQL function calls `vault.create_secret(p_api_key, 'contributor_key_<userId>')` → returns a UUID
4. UUID stored in `users.api_key_vault_id` column
5. When contributor hits any AI route, route calls `admin.rpc('get_contributor_api_key', { p_user_id })` → decrypted key returned from `vault.decrypted_secrets`
6. Route uses returned key as `x-api-key` header instead of `process.env.ANTHROPIC_API_KEY`
7. Anthropic bills the contributor's account directly

**Key is never returned to the frontend.** The settings UI only shows "Key set ✓" or "No key stored".

### 3.4 Delete with Revert

Per constitution §5.1 (no hard deletes). Soft-delete only.

| Actor | Target | Behavior |
|-------|--------|----------|
| Contributor | Own translation version | `status = 'deleted'`; if previous non-deleted version exists → `translations.current_version_id` reverts to it; if none → `current_version_id = null` |
| Contributor | Others' translation version | 403 |
| Contributor | Any manuscript or passage | 403 (admin-only) |
| Admin / Editor | Any translation version | Same soft-delete + revert logic |
| Admin | Any manuscript or passage | Existing delete endpoint (cascade, per constitution) |

Deleted versions remain in the DB and appear in version history as `[deleted]` — audit trail preserved.

### 3.5 Approval Flow

1. Any `reader`/`reviewer`/`scholar` clicks "Apply to contribute" in `/settings`
2. API sets `role = 'pending_contributor'`, records `contributor_requested_at = now()`
3. Admin sees pending requests in a new "Users" tab in the admin panel
4. Admin clicks Approve → `role = 'contributor'`; or Reject → `role` reverts to `reader`
5. No email system needed now — admin checks panel when alerted by friends directly

### 3.6 Implementation Steps

#### Migration 029 — Role enum + Vault column

```sql
-- scripts/migrations/029_add_contributor_role.sql

-- Drop and recreate the role check constraint to add new values
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('reader', 'reviewer', 'scholar', 'contributor', 'pending_contributor', 'editor', 'admin'));

-- Column to store Vault secret UUID for contributor's Anthropic API key
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS api_key_vault_id UUID DEFAULT NULL;

-- Timestamp for contributor application
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS contributor_requested_at TIMESTAMPTZ DEFAULT NULL;
```

#### Migration 030 — Supabase Vault RPC functions

```sql
-- scripts/migrations/030_create_contributor_api_key_rpcs.sql

-- Requires supabase_vault extension (enabled by default on Pro)
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- Store or update contributor's Anthropic API key in Vault
CREATE OR REPLACE FUNCTION store_contributor_api_key(p_user_id UUID, p_api_key TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_existing UUID;
  v_new_id   UUID;
BEGIN
  SELECT api_key_vault_id INTO v_existing FROM public.users WHERE id = p_user_id;
  IF v_existing IS NOT NULL THEN
    PERFORM vault.update_secret(v_existing, p_api_key);
  ELSE
    v_new_id := vault.create_secret(p_api_key, 'contributor_key_' || p_user_id::text);
    UPDATE public.users SET api_key_vault_id = v_new_id WHERE id = p_user_id;
  END IF;
END;
$$;

-- Retrieve and decrypt contributor's API key
CREATE OR REPLACE FUNCTION get_contributor_api_key(p_user_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_vault_id UUID;
  v_key      TEXT;
BEGIN
  SELECT api_key_vault_id INTO v_vault_id FROM public.users WHERE id = p_user_id;
  IF v_vault_id IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE id = v_vault_id;
  RETURN v_key;
END;
$$;

-- Delete contributor's API key from Vault and clear reference
CREATE OR REPLACE FUNCTION delete_contributor_api_key(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_vault_id UUID;
BEGIN
  SELECT api_key_vault_id INTO v_vault_id FROM public.users WHERE id = p_user_id;
  IF v_vault_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_vault_id;
    UPDATE public.users SET api_key_vault_id = NULL WHERE id = p_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION store_contributor_api_key TO service_role;
GRANT EXECUTE ON FUNCTION get_contributor_api_key TO service_role;
GRANT EXECUTE ON FUNCTION delete_contributor_api_key TO service_role;
```

#### New Files to Create

| File | Purpose |
|------|---------|
| `scripts/migrations/029_add_contributor_role.sql` | Role enum + Vault column |
| `scripts/migrations/030_create_contributor_api_key_rpcs.sql` | Vault PL/pgSQL functions |
| `app/src/lib/utils/contributor-api-key.ts` | Helper: resolves correct Anthropic key for any role |
| `app/src/app/api/settings/api-key/route.ts` | POST (store key), DELETE (remove key) |
| `app/src/app/api/settings/contributor-request/route.ts` | POST (apply to contribute), DELETE (cancel) |
| `app/src/app/api/admin/users/route.ts` | GET (list all users — admin only) |
| `app/src/app/api/admin/users/[id]/role/route.ts` | PATCH (change role — admin only) |
| `app/src/app/api/translations/versions/[versionId]/route.ts` | DELETE (soft delete with revert) |
| `app/src/app/(main)/settings/page.tsx` | Settings page (API key + contributor request) |
| `app/src/app/(main)/settings/api-key-section.tsx` | Client component: key entry/status |
| `app/src/app/(main)/admin/users-panel.tsx` | Admin Users tab: pending queue + role management |

#### Files to Modify

| File | Change |
|------|--------|
| `app/src/lib/types/index.ts` | Add `'contributor' \| 'pending_contributor'` to `UserRole` |
| `app/src/app/(main)/admin/page.tsx` | Add `'contributor'` to role check (contributors can access admin panel) |
| `app/src/app/(main)/admin/admin-dashboard.tsx` | Add "Users" tab (admin-only visibility) |
| `app/src/components/layout/header.tsx` | Add "Settings" link in user dropdown |
| All ~14 routes with `ADMIN_ROLES = ["admin", "editor"]` | Add `'contributor'` |
| All AI routes that pass `process.env.ANTHROPIC_API_KEY` | Use `getAnthropicApiKey(user.id, profile.role)` helper |
| `app/src/app/(main)/read/[book]/[chapter]/page.tsx` | Add `'contributor'` to `isAdmin` check |
| `app/src/app/(main)/manuscripts/[id]/manuscript-detail.tsx` | Add `'contributor'` to `isAdmin` check |
| `app/src/app/(main)/insights/page.tsx` | Add `'contributor'` to admin check |

#### `contributor-api-key.ts` helper (key design)

```typescript
// app/src/lib/utils/contributor-api-key.ts
import { createAdminClient } from "@/lib/supabase/admin";

export async function getAnthropicApiKey(
  userId: string,
  role: string
): Promise<{ key: string } | { error: string; status: number }> {
  if (role !== "contributor") {
    return { key: process.env.ANTHROPIC_API_KEY! };
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_contributor_api_key", { p_user_id: userId });
  if (error || !data) {
    return {
      error: "Add your Anthropic API key in Settings to use AI features as a contributor.",
      status: 402,
    };
  }
  return { key: data as string };
}
```

Each AI route replaces `process.env.ANTHROPIC_API_KEY!` with:
```typescript
const apiKeyResult = await getAnthropicApiKey(user.id, profile.role);
if ("error" in apiKeyResult) {
  return NextResponse.json({ error: apiKeyResult.error }, { status: apiKeyResult.status });
}
const { key: apiKey } = apiKeyResult;
```

### 3.7 Settings Page Design (`/settings`)

**All authenticated users see:**
- Current role badge with description
- Display name edit

**If `reader` / `reviewer` / `scholar`:**
- "Apply to contribute" button + explanation of what contributor access means
- After applying: "Application pending — an admin will review it"
- "Cancel application" button

**If `pending_contributor`:**
- "Application under review" status
- "Cancel application" button

**If `contributor`:**
- API key section:
  - Status: "API key stored ✓" or "No API key stored"
  - Input to add/update key (masked, never shown back)
  - Basic format validation (`sk-ant-` prefix)
  - Remove key button (with confirm)
  - Explanation: "Your Anthropic API key is encrypted and stored securely. It is used only when you trigger AI tasks. Your Anthropic account is billed directly."

**If `editor` / `admin`:**
- No API key section (platform key is used)
- If admin: link to Users panel in admin dashboard

### 3.8 Admin Users Panel Design

New "Users" tab in admin dashboard (visible only when `role === 'admin'`).

- Table: display_name, email, role badge, joined date, contributor_requested_at
- Filter tabs: All | Pending | Contributors | Editors | Admins
- Actions per row:
  - Pending contributor: **Approve** (→ contributor) | **Reject** (→ reader)
  - Any user: role change dropdown (admin-only)
- No pagination needed until user count exceeds ~100

### 3.9 Verification Checklist

- [ ] Migration 029 applied (check `users` table has `api_key_vault_id` column and new role values in constraint)
- [ ] Migration 030 applied (check functions exist: `SELECT proname FROM pg_proc WHERE proname LIKE '%contributor_api_key%'`)
- [ ] Contributor registers → role = `reader` (not contributor yet)
- [ ] Reader clicks "Apply to contribute" → role = `pending_contributor`
- [ ] Admin approves → role = `contributor`
- [ ] Contributor adds API key → stored in Vault (verify: `api_key_vault_id` non-null on user row)
- [ ] Contributor triggers translate → uses their key (verify: their Anthropic console shows usage, not platform account)
- [ ] Contributor with no key triggers translate → gets 402 with Settings link
- [ ] Contributor tries to delete their own translation version → soft-deletes, reverts to previous
- [ ] Contributor tries to delete another user's version → 403
- [ ] Admin sees Users tab in admin panel with pending contributor listed
- [ ] Editor does NOT see Users tab
- [ ] Contributor sees admin panel (Operations/Registry/Tasks tabs)
- [ ] Build: `cd app && npm run build` — zero type errors

---

## 4. Phase 6 — Future Scope (Deferred)

These are real goals but have no timeline. Do not build until Phase 5 is live and stable.

### Internal credit system
- Users deposit credits via Stripe (dollars → balance)
- Each AI task deducts from balance based on actual token cost
- `user_credits` table + `credit_transactions` table
- Gate AI tasks: check balance before executing
- Currently deferred: no external user base to justify billing infrastructure

### API key migration — Vault → per-environment key rotation
- When contributor count grows, add key rotation reminders
- Detect stale keys (last used > 90 days) and prompt re-entry
- Currently unnecessary at friend-scale

### Cross-manuscript synthesis summaries
- `POST /api/summaries/cross-manuscript` — Sonnet
- Meaningful only when multiple manuscripts exist for same text with variant detection runs
- Currently no multi-manuscript data to justify

### Donation page
- Ko-fi or GitHub Sponsors link in footer
- Already have `/about/sources` page with license disclaimer
- One-line addition when ready

### Streaming translation response
- Replace `maxDuration=300` + large AbortController with true streaming
- Defeats function timeout for extremely long passages
- Current fix (300s limit) is good enough until Vercel function limits become an actual problem

---

## 5. Migration Apply Order

When resuming execution, apply in this order:
1. `029_add_contributor_role.sql`
2. `030_create_contributor_api_key_rpcs.sql`

Then execute all code changes in Phase 5 before testing.

---

## 6. Active Plan Files

| File | Status |
|------|--------|
| `docs/design/master-plan-2026.md` | **Active — this file** |
| `docs/design/phase4-strategic-roadmap-2026.md` | Superseded — work complete |
| `docs/design/ingestion-rework-2026.md` | Superseded — work complete |
| `~/.claude/plans/stateless-forging-willow.md` | Superseded — see this file |
