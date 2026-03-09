# CodexAtlas — Security Summary

> Compressed context for agents handling auth, data access, and security. Source of truth: `/docs/`

## Authentication

- **Provider**: Supabase Auth
- **Methods**: Email/password, OAuth (Google, GitHub), magic link
- **Tokens**: JWT issued by Supabase, verified server-side
- **Session**: Managed by Supabase client library, auto-refresh

## API Keys

| Key | Scope | Rules |
|-----|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Public, safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Public, safe to expose; RLS enforced |
| `SUPABASE_SERVICE_ROLE_KEY` | Server ONLY | **NEVER in client code**, bypasses RLS |
| `ANTHROPIC_API_KEY` | Server ONLY | **NEVER in client code** |
| `FIREBASE_CONFIG` | Client + Server | Public config for notifications |

**Rule**: Any key not prefixed with `NEXT_PUBLIC_` must never appear in client-side code or browser bundles.

## Row-Level Security (RLS)

- **Enabled on ALL tables** — no exceptions
- Policies defined per role per table
- `anon` key operations are always subject to RLS
- `service_role` key bypasses RLS — use only in trusted server contexts
- Every new table must have RLS enabled before deployment

## Roles & Permissions

| Role | Read | Create | Edit | Manage | Admin |
|------|------|--------|------|--------|-------|
| `reader` | Published content | — | — | — | — |
| `reviewer` | + Drafts under review | Submit reviews | — | — | — |
| `scholar` | + Own drafts | Translations, variants, evidence | Own content | — | — |
| `editor` | All content | All content types | All content | Moderate reviews, manage content | — |
| `admin` | Everything | Everything | Everything | Everything | Users, roles, system config |

Permissions are **escalating** — each role inherits all permissions of roles below it.

## API Security

- **Rate limiting**: Applied on all public endpoints
- **Input validation**: Zod schemas on all API route inputs
- **CORS**: Restricted to allowed origins only
- **Secrets in URLs**: Prohibited — no tokens or keys in query strings
- **Error responses**: Sanitized — no stack traces, internal paths, or sensitive data in responses
- **CSRF**: Handled by Supabase Auth token verification

## Agent Security

- **Scoped tokens**: Agents use tokens with limited permissions (never admin)
- **Action logging**: All agent actions logged in `audit_log` with `actor_type='agent'`
- **User/role modification**: Agents **cannot** modify `users` table or role assignments
- **Cost limits**: Per-agent and per-session token budgets enforced
- **Sandboxed**: Agents operate only within their task packet scope

## Data Integrity

- **No hard deletes**: Soft delete via `archived_at` on all tables
- **Audit log**: Immutable record of every mutation (actor, action, target, diff)
- **Foreign key constraints**: Enforced at database level
- **Check constraints**: `version_number > 0`, valid enums, non-null required fields
- **Evidence requirement**: `translation_versions` must reference an `evidence_record`

## Required Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
ANTHROPIC_API_KEY=

# Firebase (notifications)
FIREBASE_CONFIG=

# Optional
NEXT_PUBLIC_SITE_URL=
LOG_LEVEL=
```

## Security Checklist for Agents

- [ ] Never expose `SUPABASE_SERVICE_ROLE_KEY` or `ANTHROPIC_API_KEY` in client code
- [ ] Verify RLS is enabled on any new table before deploying
- [ ] Validate all inputs with Zod before database operations
- [ ] Log all mutations to `audit_log`
- [ ] Never perform hard deletes
- [ ] Never modify user roles or permissions
- [ ] Sanitize all error responses
