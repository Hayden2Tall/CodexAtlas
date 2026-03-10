# CodexAtlas Security Model

> Security architecture for the CodexAtlas AI-assisted research platform for ancient religious manuscripts.
>
> **Tech stack:** Next.js on Vercel · Supabase (Postgres with RLS) · Firebase (notifications) · Claude AI models

---

## 1. Security Principles

All security decisions in CodexAtlas follow these foundational principles:

- **Defense in depth.** No single layer is trusted in isolation. Authentication, authorization, RLS policies, input validation, and infrastructure protections each operate independently so that a failure in one layer does not compromise the system.
- **Least privilege.** Every role, token, and service account receives the minimum permissions required to perform its function. Elevated access is granted explicitly and scoped narrowly.
- **Transparency.** Security policies are documented in this file, enforced in code, and auditable through logs. There is no security through obscurity — the platform is open source, and its protections must hold even with full knowledge of the implementation.
- **Database-level enforcement.** All data integrity and access control rules are enforced at the Postgres level through Row-Level Security (RLS), foreign key constraints, check constraints, and triggers. Application-level checks exist as a secondary layer, never as the sole enforcement mechanism.
- **Auditability.** Every mutation is logged. Every privileged action is attributable to a specific user or agent.

---

## 2. Authentication

### Identity Provider

Supabase Auth is the sole identity provider. All user identity flows — registration, login, session management, and password recovery — are handled through the Supabase Auth API.

### Supported Authentication Methods

| Method | Use Case |
|---|---|
| Email / Password | Standard account creation and login |
| OAuth (Google) | Federated sign-in for Google accounts |
| OAuth (GitHub) | Federated sign-in for contributors |
| Magic Link | Passwordless email-based login |

### Session Management

- Supabase Auth issues **JWT access tokens** and **refresh tokens** on successful authentication.
- The access token is short-lived (default: 1 hour). The refresh token is long-lived and stored securely by the Supabase client SDK.
- The frontend SDK handles automatic token refresh. When an access token expires, the SDK uses the refresh token to obtain a new pair transparently.
- If the refresh token is expired or revoked, the user is redirected to re-authenticate.

### API Route Protection

- **Every protected API route** extracts the JWT from the `Authorization: Bearer <token>` header and validates it against the Supabase JWT secret before processing the request.
- Use `createServerClient` from `@supabase/ssr` in Next.js API routes and middleware to validate the session server-side.
- Unauthenticated requests to protected endpoints receive a `401 Unauthorized` response with no additional detail.

### Service Role Key

- The Supabase **service role key** bypasses RLS and has full database access. It is used exclusively in server-side pipeline operations (e.g., AI agent pipelines, batch processing).
- The service role key is **never** exposed to the client, included in client bundles, or sent in any API response.
- Server-side code that uses the service role key must be in API routes, serverless functions, or background jobs — never in components or client-side modules.

---

## 3. Authorization and Roles

### Role Hierarchy

```
Admin
  └── Editor
        └── Scholar
              └── Reviewer
                    └── Reader
```

Each role inherits all permissions of the roles below it. Roles are stored in a `user_roles` table and referenced in RLS policies via a helper function.

### Helper Function

```sql
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text AS $$
  SELECT role FROM public.user_roles WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

RLS policies call `get_user_role(auth.uid())` to determine the requesting user's role.

### Role Definitions

#### Reader (default)

Assigned to unauthenticated users and basic accounts. This is the implicit role when no explicit role exists.

| Permission | Scope |
|---|---|
| View manuscripts | Published, non-archived only |
| View passages and translations | Published versions only |
| View variant analyses | Published only |
| View evidence records | Published only |
| View research packages | Public packages only |

Readers **cannot** submit reviews, create content, or access draft materials.

#### Reviewer (authenticated, approved)

Granted to authenticated users who have been approved for review participation.

| Permission | Scope |
|---|---|
| All Reader permissions | — |
| Submit reviews | On published translation versions |
| View review clusters | Associated with reviewed content |
| Edit own reviews | Own submissions only |

#### Scholar (authenticated, verified credentials)

Granted to users with verified academic or domain credentials.

| Permission | Scope |
|---|---|
| All Reviewer permissions | — |
| Submit translations | New translation versions |
| Submit variant analyses | For passages they have access to |
| Create research packages | Own packages |
| Access advanced research tools | AI-assisted analysis features |
| View draft content | Own drafts only |

#### Editor (trusted contributor)

Granted to trusted, vetted contributors who help maintain content quality.

| Permission | Scope |
|---|---|
| All Scholar permissions | — |
| Edit manuscript metadata | All manuscripts |
| Manage translation status | Promote/demote translation versions |
| Moderate reviews | Flag, hide, or escalate reviews |
| View all drafts | All users' draft content |

#### Admin (platform maintainers)

Full access. Reserved for platform maintainers.

| Permission | Scope |
|---|---|
| All Editor permissions | — |
| Manage users and roles | Assign/revoke any role |
| Access audit logs | Full audit trail |
| Configure system settings | Platform-wide configuration |
| Delete/archive any content | Emergency content management |
| Manage API keys and integrations | Service configuration |

---

## 4. Row-Level Security (RLS)

### Policy

**RLS is enabled on every table in the Supabase database.** No table exists without RLS policies. If a new table is created without policies, it is inaccessible by default — this is intentional and correct.

### Policy Design

Each table has policies defined per operation (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) per role. Policies use `auth.uid()` and `get_user_role(auth.uid())` to evaluate access.

### Example Policies

#### `manuscripts`

```sql
-- Anyone can read published, non-archived manuscripts
CREATE POLICY "manuscripts_select_published" ON public.manuscripts
  FOR SELECT USING (
    status = 'published' AND archived_at IS NULL
  );

-- Editors and above can update manuscript metadata
CREATE POLICY "manuscripts_update_editors" ON public.manuscripts
  FOR UPDATE USING (
    get_user_role(auth.uid()) IN ('editor', 'admin')
  );

-- Admins can soft-delete (archive) manuscripts
CREATE POLICY "manuscripts_archive_admin" ON public.manuscripts
  FOR UPDATE USING (
    get_user_role(auth.uid()) = 'admin'
  )
  WITH CHECK (archived_at IS NOT NULL);
```

#### `translation_versions`

```sql
-- Anyone can read published translations
CREATE POLICY "translations_select_published" ON public.translation_versions
  FOR SELECT USING (
    status = 'published' AND archived_at IS NULL
  );

-- Scholars can read their own drafts
CREATE POLICY "translations_select_own_drafts" ON public.translation_versions
  FOR SELECT USING (
    author_id = auth.uid() AND status = 'draft'
  );

-- Scholars and above can insert new translations
CREATE POLICY "translations_insert_scholars" ON public.translation_versions
  FOR INSERT WITH CHECK (
    get_user_role(auth.uid()) IN ('scholar', 'editor', 'admin')
    AND author_id = auth.uid()
  );
```

#### `reviews`

```sql
-- All users can read reviews
CREATE POLICY "reviews_select_all" ON public.reviews
  FOR SELECT USING (archived_at IS NULL);

-- Reviewers can insert reviews they authored
CREATE POLICY "reviews_insert_reviewers" ON public.reviews
  FOR INSERT WITH CHECK (
    get_user_role(auth.uid()) IN ('reviewer', 'scholar', 'editor', 'admin')
    AND reviewer_id = auth.uid()
  );

-- Reviewers can update their own reviews
CREATE POLICY "reviews_update_own" ON public.reviews
  FOR UPDATE USING (
    reviewer_id = auth.uid()
  );
```

#### `audit_log`

```sql
-- Authenticated users can read the audit log
CREATE POLICY "audit_log_select_authenticated" ON public.audit_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- No INSERT policy for regular users; inserts happen via
-- SECURITY DEFINER triggers and service role only
```

#### `agent_tasks`

```sql
-- Admins and editors have full access
CREATE POLICY "agent_tasks_admin_all" ON public.agent_tasks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

-- All authenticated users can read agent tasks
CREATE POLICY "agent_tasks_authenticated_select" ON public.agent_tasks
  FOR SELECT USING (auth.role() = 'authenticated');
```

#### `manuscript_source_texts`

This table stores preprocessed manuscript transcription data populated by one-time offline scripts using the service role key. It is read-only reference data — no end user or application API ever writes to it.

```sql
-- Public read access (no authentication required)
CREATE POLICY "manuscript_source_texts_public_read" ON public.manuscript_source_texts
  FOR SELECT USING (true);

-- No INSERT/UPDATE/DELETE policies: writes happen exclusively via the
-- service role key in preprocessing scripts. This is a deliberate design
-- choice — the data is reference material from external scholarly sources,
-- not user-generated content.
```

### Service Role and RLS

The Supabase service role key bypasses all RLS policies. This is used exclusively for:

- AI pipeline operations that write results across multiple tables
- Batch processing and migrations
- Audit log insertions from triggers (`SECURITY DEFINER` functions)

The service role is **never** used in any client-facing request path.

---

## 5. API Security

### Authentication Requirements

| Route Pattern | Auth Required |
|---|---|
| `GET /api/manuscripts` (published) | No |
| `GET /api/passages/:id` (published) | No |
| `POST /api/translations` | Yes |
| `POST /api/reviews` | Yes |
| `PATCH /api/manuscripts/:id` | Yes (Editor+) |
| `GET /api/admin/*` | Yes (Admin) |

Public read endpoints serve only published, non-archived content. All mutation endpoints require authentication.

### Rate Limiting

Implement rate limiting at the API route level using an in-memory or Redis-backed store.

| Scope | Limit | Window |
|---|---|---|
| Per-IP (unauthenticated) | 60 requests | 1 minute |
| Per-user (authenticated) | 120 requests | 1 minute |
| Per-user (AI tool calls) | 20 requests | 1 minute |
| Per-IP (auth endpoints) | 10 requests | 15 minutes |

Return `429 Too Many Requests` with a `Retry-After` header when limits are exceeded.

### Input Validation

- Validate **all** request bodies, query parameters, and path parameters against Zod schemas before processing.
- Reject invalid input with `400 Bad Request` and a generic validation error message — never echo back the raw input.
- Sanitize all user-provided text stored in the database to prevent stored XSS.

### CORS

```typescript
const allowedOrigins = [
  process.env.NEXT_PUBLIC_APP_URL,
  // Add additional trusted origins as needed
];
```

- Only origins in the allowlist receive CORS headers.
- Credentials are allowed only for same-site requests.
- Preflight responses are cached for 1 hour.

### CSRF Protection

- Use `SameSite=Lax` (or `Strict` where appropriate) on all cookies.
- For state-changing operations initiated from forms, validate a CSRF token.
- API routes that accept only JSON with `Content-Type: application/json` are inherently resistant to simple CSRF attacks, but defense in depth applies.

### Response Headers

Set the following headers on all responses:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
```

Configure these in `next.config.js` via the `headers` function or in middleware.

### Error Handling

- Never expose stack traces, SQL errors, or internal identifiers in error responses.
- Use generic error messages for client-facing responses: `"An error occurred"`, `"Not found"`, `"Unauthorized"`.
- Log full error details server-side for debugging.

### URL Parameter Safety

- Never include secrets, tokens, or sensitive identifiers in URL query parameters.
- Use request bodies for sensitive data and `POST` methods for actions that include credentials or tokens.

---

## 6. Data Integrity

### Soft Deletes

No records are hard-deleted from the database. All deletions set an `archived_at` timestamp:

```sql
ALTER TABLE manuscripts ADD COLUMN archived_at timestamptz DEFAULT NULL;
```

All `SELECT` queries in RLS policies and application code filter on `archived_at IS NULL` by default. Archived records are retained indefinitely for audit and research integrity purposes.

### Audit Logging

Every mutation (INSERT, UPDATE, soft DELETE) is logged in the `audit_log` table:

```sql
CREATE TABLE public.audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp   timestamptz NOT NULL DEFAULT now(),
  actor_id    uuid REFERENCES auth.users(id),
  actor_type  text NOT NULL CHECK (actor_type IN ('user', 'agent', 'system')),
  action      text NOT NULL,
  table_name  text NOT NULL,
  record_id   uuid NOT NULL,
  old_values  jsonb,
  new_values  jsonb,
  metadata    jsonb
);
```

Audit log entries are created by database triggers using `SECURITY DEFINER` functions, ensuring they cannot be bypassed by application code:

```sql
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.audit_log (actor_id, actor_type, action, table_name, record_id, old_values, new_values)
  VALUES (
    auth.uid(),
    COALESCE(current_setting('app.actor_type', true), 'user'),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Database Constraints

#### Foreign Keys

All relational references use foreign key constraints with appropriate `ON DELETE` behavior (typically `RESTRICT` to prevent orphaned references).

#### Check Constraints

```sql
ALTER TABLE translation_versions
  ADD CONSTRAINT valid_status CHECK (status IN ('draft', 'in_review', 'published', 'archived'));

ALTER TABLE reviews
  ADD CONSTRAINT valid_score CHECK (score >= 1 AND score <= 5);

ALTER TABLE manuscripts
  ADD CONSTRAINT valid_language CHECK (language IS NOT NULL AND length(language) > 0);
```

#### Unique Constraints

```sql
ALTER TABLE manuscripts
  ADD CONSTRAINT unique_citation_id UNIQUE (citation_id);

ALTER TABLE passages
  ADD CONSTRAINT unique_passage_ref UNIQUE (manuscript_id, book, chapter, verse_start);
```

---

## 7. Agent Security

AI agents (Claude-powered) operate within strict boundaries to prevent unintended data modifications or privilege escalation.

### Authentication and Scope

- Agents authenticate with **scoped service tokens** that grant access only to the specific tables and operations the agent requires. Agents do not use admin tokens.
- Each agent's token is generated for a single pipeline run and expires after the run completes.
- Agent tokens are passed via `Authorization` headers, same as user tokens, but with `actor_type = 'agent'` set in the request context.

### Audit Trail

- Every action performed by an agent is logged in `audit_log` with `actor_type = 'agent'`.
- The `metadata` field includes the agent name, pipeline run ID, and model version.
- Agent audit entries are queryable and reviewable by Editors and Admins.

### Restrictions

| Restriction | Enforcement |
|---|---|
| Cannot modify user accounts or roles | RLS policies + application checks |
| Cannot bypass RLS in application context | Uses scoped tokens, not service role |
| Cannot access admin endpoints | Token scope excludes admin routes |
| Cannot delete or archive content | Token scope excludes destructive operations |

### Pipeline Operations

When agents need to perform bulk writes (e.g., writing analysis results to the database), the server-side pipeline runner uses the service role key — but the agent itself does not hold this key. The pipeline runner validates agent output before writing.

### Cost Controls

- Each pipeline run has a **token budget** (max input + output tokens) configured per agent type.
- If an agent exceeds its token budget, the pipeline terminates the run and logs the overage.
- Daily and monthly spend caps are configured at the platform level and enforced before any API call to Claude.
- Spend alerts trigger at 75% and 90% of budget thresholds.

### Autonomy Modes

| Mode | Description | Allowed Actions |
|---|---|---|
| `assisted` | Agent suggests, human approves | Generate suggestions only |
| `supervised` | Agent executes, human reviews | Write to staging tables, flag for review |
| `autonomous` | Agent executes independently | Write to production tables (scoped) |

The autonomy mode is set per pipeline configuration and enforced at the pipeline runner level.

---

## 8. Secrets Management

### Principles

- **No secrets in source code.** Not in variables, comments, or configuration files committed to version control.
- **All secrets are provided via environment variables** at runtime.
- `.env` files are listed in `.gitignore` and never committed.

### Secret Inventory

| Secret | Scope | Exposure |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Public (safe) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Public (safe, scoped by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Private (bypasses RLS) |
| `NEXT_PUBLIC_FIREBASE_CONFIG` | Client + Server | Public (safe, Firebase security rules apply) |
| `FIREBASE_ADMIN_SDK_KEY` | Server only | Private |
| `ANTHROPIC_API_KEY` | Server only | Private |
| `SUPABASE_JWT_SECRET` | Server only | Private |

### Rules

1. **`NEXT_PUBLIC_` prefix** variables are embedded in the client bundle by Next.js — only use this prefix for values that are safe to expose publicly.
2. **`SUPABASE_SERVICE_ROLE_KEY`** must only be imported in files under `app/api/`, `lib/server/`, or pipeline scripts — never in components, hooks, or client utilities.
3. **`ANTHROPIC_API_KEY`** is used exclusively in server-side API routes that proxy requests to Claude. The client never communicates directly with the Anthropic API.
4. All required environment variables must be documented in the project `README.md` with descriptions and example formats (but not actual values).

### Verification

Add a startup check that verifies all required environment variables are set:

```typescript
const REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
] as const;

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}
```

---

## 9. Dependency Security

### Auditing

- Run `npm audit` as part of the CI pipeline. Builds fail on `critical` or `high` severity vulnerabilities.
- Enable **Dependabot** (or Renovate) on the GitHub repository for automated dependency update PRs.
- Review Dependabot PRs weekly. Do not auto-merge major version bumps.

### Version Pinning

- Pin **major versions** in `package.json` using the `^` (caret) range to allow patch and minor updates.
- Use a lockfile (`package-lock.json`) committed to version control to ensure reproducible builds.
- Before upgrading a major version of any dependency, review the changelog for breaking changes and security implications.

### Dependency Hygiene

- Evaluate necessity before adding any new dependency. Prefer built-in APIs and small, focused packages.
- Remove unused dependencies promptly.
- The Security Agent (automated) monitors for CVE announcements affecting project dependencies and opens issues when vulnerabilities are disclosed.

---

## 10. Infrastructure Security

### Vercel (Hosting)

- Automatic HTTPS with managed TLS certificates.
- DDoS protection at the edge network.
- Environment variables configured in the Vercel dashboard — not in source code.
- Preview deployments use the same security headers as production.
- Serverless functions run in isolated environments with no persistent filesystem.

### Supabase (Database & Auth)

- Managed Postgres with automatic daily backups.
- Data encrypted at rest (AES-256) and in transit (TLS 1.2+).
- Database accessible only via the Supabase API — direct connections restricted to allow-listed IPs if enabled.
- Point-in-time recovery available for disaster recovery.
- Connection pooling via Supavisor to prevent connection exhaustion.

### Firebase (Notifications)

- Used exclusively for push notifications.
- Firebase Security Rules restrict read/write access to notification tokens.
- Firebase Admin SDK used server-side only for sending notifications.
- No user data is stored in Firebase beyond notification tokens.

### GitHub (Source Control)

- Branch protection rules on `main`: require PR reviews, require status checks to pass.
- No direct pushes to `main`.
- Required reviewers for changes to security-sensitive files (this document, RLS policies, auth middleware).
- Secrets scanning enabled to prevent accidental credential commits.

---

## 11. Incident Response

### Reporting

- Security vulnerabilities are reported via **GitHub Security Advisories** (private disclosure).
- Do not open public issues for security vulnerabilities.
- Reports should include: affected component, reproduction steps, severity assessment, and suggested remediation if known.

### Response Timeline

| Severity | Response Target | Patch Target |
|---|---|---|
| Critical (active exploitation, data exposure) | 4 hours | 24 hours |
| High (exploitable, no known exploitation) | 24 hours | 72 hours |
| Medium (limited impact or difficult to exploit) | 72 hours | 1 week |
| Low (theoretical, minimal impact) | 1 week | Next release cycle |

### Process

1. **Triage.** Confirm the vulnerability and assess severity.
2. **Contain.** If actively exploited, take immediate containment measures (revoke tokens, disable affected endpoints, enable maintenance mode if necessary).
3. **Fix.** Develop and test a patch in a private branch.
4. **Deploy.** Ship the fix to production.
5. **Document.** Record the incident in `DEVELOPMENT_LOG.md` including root cause, impact, timeline, and remediation.
6. **Review.** Conduct a post-incident review to identify systemic improvements.

### Communication

- Affected users are notified if their data was accessed or compromised.
- A public advisory is published after the fix is deployed, detailing the vulnerability and remediation.

---

## 12. Compliance Considerations

### GDPR

- **Data minimization.** Collect only the data required for platform functionality.
- **Right to access.** Users can export their data (submissions, reviews, profile) via account settings.
- **Right to erasure.** Because manuscript research data has long-term scholarly value, deletion is handled via **anonymization** rather than record removal. User-identifiable fields are replaced with `[deleted_user]`, preserving the integrity of the research record while removing personal information. This approach is documented in the privacy policy and accepted by users at registration.
- **Data processing records.** Maintain a record of what data is collected, why, and how long it is retained.
- **Cookie consent.** Implement cookie consent for any non-essential cookies (analytics, etc.).

### Accessibility

- Target **WCAG 2.1 Level AA** compliance.
- Accessibility is a security concern — inaccessible interfaces can prevent users from managing their security settings.
- Automated accessibility testing in CI (axe-core or similar).

### Open Source License Compliance

- All dependencies must have licenses compatible with the project's license.
- License audit is part of the CI pipeline.
- Attribution is maintained in a `LICENSES` or `NOTICE` file as required by dependency licenses.

---

## 13. Security Checklist for Development

Before any deployment, the developer or agent responsible for the change must verify:

### Database Changes
- [ ] RLS is enabled on all new tables
- [ ] RLS policies are defined and tested for every role (Reader through Admin)
- [ ] RLS policies tested with the Supabase policy editor or test suite
- [ ] Foreign key constraints are defined for all relational columns
- [ ] Check constraints are defined for status fields, scores, and bounded values
- [ ] Audit logging triggers are attached to all new tables with mutable data
- [ ] Soft delete (`archived_at`) column exists on all content tables

### API Changes
- [ ] All mutation endpoints require authentication
- [ ] JWT validation occurs before any business logic
- [ ] Role checks enforce the correct minimum role for the operation
- [ ] Input validation schemas (Zod) are defined for all request bodies
- [ ] Error responses do not leak internal details (no stack traces, no SQL errors)
- [ ] Rate limiting is configured for new endpoints

### Secrets and Configuration
- [ ] No secrets, tokens, or keys in committed code
- [ ] New environment variables are documented in README
- [ ] Server-only secrets are not prefixed with `NEXT_PUBLIC_`
- [ ] Service role key usage is confined to server-side code

### Dependencies
- [ ] `npm audit` reports no critical or high vulnerabilities
- [ ] New dependencies are justified and reviewed
- [ ] New dependencies have compatible licenses

### Agent Changes
- [ ] Agent actions are logged with `actor_type = 'agent'`
- [ ] Agent token scope is limited to required operations
- [ ] Cost controls and token budgets are configured
- [ ] Agent cannot modify user accounts or roles

### General
- [ ] Security headers are present on all responses
- [ ] CORS configuration allows only trusted origins
- [ ] No sensitive data in URL parameters
- [ ] Changes to security-critical code have been reviewed by a second contributor
