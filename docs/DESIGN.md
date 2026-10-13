# Design: Pasadena Law & Policy Review application

Status: S0 design, written before implementation. Sections marked *(verify)* are confirmed against the installed library during the stage that implements them.

## 1. Architecture summary

One TypeScript server-rendered application (Next.js App Router) backed by PostgreSQL.

- **Authentication:** a maintained library (Better Auth) stores users, sessions and tokens in the same database.
- **Authorization:** roles and account status live in the application's own tables, never in the auth user record. They are checked on the server for every protected read and every mutation.
- **Email:** goes through a transactional outbox and a provider adapter (Resend in production, a development mailbox locally).
- **Manuscript attachments:** live in private storage behind authorized download routes.
- **Public pages:** server-rendered from published, immutable snapshots.

Why this stack (the repository had no backend to reuse):

- No database, Docker or hosting CLI exists locally. PGlite (Postgres compiled to WebAssembly) gives real Postgres semantics for local development and tests without Docker.
- Production uses any managed Postgres through `DATABASE_URL`. The same SQL migrations run on both.
- Better Auth avoids hand-rolled password hashing, tokens and sessions, and it supports database-backed sessions that can be revoked immediately.
- The application is host-agnostic: `next build && next start` on a Node host, or a platform that runs Next.js. Hosting is an owner decision (`manual_todo.md`).

## 2. Runtime and dependencies

- **Node:** 22 LTS (`engines`: `>=22 <23`, `.nvmrc`).
- **Packages:** npm with a committed `package-lock.json`. `.npmrc` sets `save-exact=true`, so versions are pinned.
- **Core:** Next.js 16.4, React 19.3, TypeScript 5.9 (TypeScript 7's native compiler is avoided until Next.js tooling supports it).
- **Data:** Drizzle ORM 0.45, drizzle-kit 0.31 (SQL migrations), `pg` (production driver), `@electric-sql/pglite` (development and tests).
- **Auth:** Better Auth 1.7.
- **Validation:** zod.
- **Rendering:** unified + remark/rehype for Markdown to sanitized HTML.
- **Storage:** aws4fetch for S3-compatible signed requests.
- **Tests:** Vitest (unit and integration on PGlite), Playwright (browser journeys on the installed Chrome locally, bundled Chromium in CI).

## 3. What runs where

| Layer | Responsibilities |
|---|---|
| **Browser** | Server-rendered HTML. Small client components only for: the manuscript editor toolbar, the unsaved-changes guard, the preview toggle and confirmation dialogs. No authorization decisions and no secrets. Forms post to same-origin route handlers and work without JavaScript where practical. |
| **Server** (Next.js route handlers and server components) | Session resolution, authorization, validation, state transitions, rendering, outbox writes, storage access, rate limits. Every mutation is a `POST`/`PATCH`/`DELETE` route handler under `/api` that calls the service layer. |
| **Database** (Postgres) | Constraints, foreign keys, unique indexes, immutability triggers on revisions and published versions, transactional state changes. |
| **Background work** | The email dispatcher runs after the commit (`after()`) and through a job runner. The runner is `POST /api/jobs/run`, protected by `CRON_SECRET` for platform cron, plus `npm run jobs:run` for a worker or cron host. It is idempotent, and rows are locked with `FOR UPDATE SKIP LOCKED`, so concurrent runners don't double-send. |

## 4. Authentication and sessions *(verify against Better Auth 1.7)*

- **Account:** email and password. Minimum 10 characters. Sign-up requires `name`, `email` and `password`.
- **Verification:** required before sign-in. Better Auth sends verification and reset links through our email adapter (the outbox). Verification links expire (1 hour). Resending the link is rate-limited.
- **Password reset:** expiring, single-use tokens. All of the user's sessions are revoked on reset.
- **Sessions:** stored in the database. The cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production. The cookie cache is **off**, so deleting a session ends access on the next request.
- **Suspension:** sets `memberships.status = 'suspended'` and deletes the user's sessions.
- **Role changes:** take effect on the next request, because the role is read from the database every time.
- **Errors:** sign-in failures return a generic message. Account enumeration on sign-up and reset is limited as far as the library allows; residual behavior is documented in `verification.md`.

## 5. Authorization

- `getActor(headers)` resolves the session, then loads `memberships` (role, status) and `emailVerified`.
- Services receive the actor and call policy functions (`src/server/policy.ts`). The client never supplies a role, owner, author, state or file path.
- **Roles:** `member` (author), `editor`, `admin`. **Statuses:** `active`, `suspended`. **Unverified accounts** can only verify, resend and recover.
- **Admin access** is granted only by an existing active admin (audited), or by the operator CLI `npm run admin:bootstrap`, which works only while no active admin exists. No web endpoint promotes the first admin, and no credentials are hardcoded.
- **Last admin protection:** demoting or suspending the last active admin is refused, inside a transaction.
- **CSRF:** non-GET route handlers require an `Origin` header matching `APP_URL`. Cookies are `SameSite=Lax`. Better Auth's own endpoints use its trusted-origin checks.
- **Not applicable: row-level security.** The browser never connects to the database; one server role is used. If a client-side database SDK is ever introduced, RLS becomes mandatory.

## 6. Data model

All timestamps are `timestamptz` (UTC). Display uses the configured publication timezone (default `America/Los_Angeles`). Meetings store an explicit IANA timezone.

| Table | Purpose and key constraints |
|---|---|
| `user`, `session`, `account`, `verification`, `rate_limit` | Better Auth core tables. The password hash lives in `account`. |
| `memberships` | `user_id` primary key, `role`, `status`. Created on sign-up as `member`/`active`. Never writable by profile updates. |
| `author_profiles` | Public byline name and bio, separate from private account fields. |
| `editorial_applications` | Statement, experience, and status: `pending` / `approved` / `declined` / `withdrawn`. Decision fields. One pending application per user (partial unique index). |
| `manuscripts` | Owner (`author_id`, nullable only for migrated content, plus `attribution_note`), `kind`, `status`, working copy (title, deck, abstract, `body_md`, `author_bio`), and `version` for optimistic concurrency. |
| `manuscript_revisions` | Immutable snapshots. `source` is `author_submission` or `editor_edit`. Sequence number unique per manuscript. A trigger forbids `UPDATE` and `DELETE`. |
| `review_assignments` | Which editors review a manuscript. Unique per (manuscript, editor) while active. |
| `review_recommendations` | One per (revision, editor): `accept` / `changes` / `decline` plus an internal rationale. |
| `author_feedback` | Author-visible comments. The only review text an author can read. |
| `internal_notes` | Editors' private notes. Never queried by author-facing code or email templates. |
| `editorial_decisions` | `accept` / `request_changes` / `decline` / `reopen`, plus the author-visible note and the deciding admin. |
| `publication_checks` | Per-manuscript checklist (e.g. "author permission", "citations verified"). Publishing is blocked while any check is open. |
| `publications` | One per manuscript: slug (unique), kind, issue and order, public byline, `state` (`live`/`unpublished`), pointer to the current version. |
| `publication_versions` | Immutable published snapshots: revision id, title, deck, rendered sanitized HTML, metadata, publisher, time. Rollback re-points the publication. |
| `volumes`, `issues` | Numbering, term label, display order, `visible` flag. Unique (volume, number). |
| `meetings` | Status (`draft` / `announced` / `held` / `cancelled`), `starts_at` and `timezone` (nullable until announced), location, motion, openers, attendance policy, minutes (Markdown), minutes publication flag. |
| `cms_pages`, `cms_page_versions` | Page keys (about, submissions, meetings intro, editor's note, independence). Versions move through `draft`, `proposed`, `published`, `superseded`. Editors propose; admins publish. |
| `site_settings` | Key/value (JSON): publication name, contact and submissions addresses, timezone, front-page lead, nameplate issue line, masthead visibility, membership approval mode. |
| `masthead_entries` | Role, real name, order. Public only when the roster is published. |
| `attachments` | Manuscript, uploader, storage key (random), sanitized original name, MIME type, size, sha256, deleted flag. |
| `email_jobs` | Kind, recipient, template data (status summaries only), idempotency key (unique), status (`queued` / `sending` / `accepted` / `delivered` / `bounced` / `failed`), attempts, `next_attempt_at`, last error, provider message id. |
| `email_events` | Webhook events (delivered, bounced, complained) linked to jobs. |
| `audit_events` | Actor, action, target, small metadata. Never passwords, tokens or manuscript bodies. |
| `app_rate_limits` | Fixed-window counters for application endpoints (submissions, uploads, applications). |

## 7. Manuscript state machine

| From | To | Who | Guard |
|---|---|---|---|
| `draft` | `submitted` | Author | Required fields present; authorship, source-accuracy and disclosure confirmations; creates a revision |
| `submitted`, `resubmitted` | `in_review` | Editor (self-assign) or admin (assign) | Editor is not the author |
| `in_review`, `submitted`, `resubmitted` | `changes_requested` | Admin | Not the author; decision note to the author required |
| `changes_requested` | `resubmitted` | Author | Creates a new revision |
| `in_review`, `resubmitted` | `accepted` | Admin | Not the author; **two recommendations from two different non-author editors on the current revision** |
| any pre-publication state | `declined` | Admin | Not the author |
| `declined` | `in_review` | Admin ("reopen") | Explicit, audited |
| `draft` … `accepted` | `withdrawn` | Author | Confirmation; history retained |
| `accepted` | `published` | Admin | Selected approved revision, slug, byline, no open publication checks |
| `published` | `accepted` | Admin ("unpublish") | The publication record and all its versions are kept, with state `unpublished` (§8) |

**Editing rules:**
- Authors edit the working copy only in `draft` and `changes_requested`.
- Editors may create `editor_edit` revisions while the manuscript is `in_review`, `resubmitted` or `accepted`.
- Every transition is a single conditional `UPDATE … WHERE id = $1 AND status = $2 AND version = $3`. Zero rows updated returns 409 Conflict.
- Duplicate clicks therefore can't create duplicate decisions or emails.

## 8. Publication invariants

1. Acceptance and publication are separate actions.
2. Public routes read only `publications` whose state is `live` through their current `publication_versions` row. They never read manuscripts, revisions or drafts.
3. A publication version is an immutable snapshot. Later author or editor edits never change what readers see. Changing the public text requires another publish action, and the previous version remains available for rollback.
4. Publishing requires an `accepted` manuscript (or one already published, for republishing), a chosen revision of that manuscript, a unique slug, a public byline, and zero open publication checks.
5. Unpublishing removes the article from every public route and index immediately. History is retained.
6. Editors see which revision and version is live.

## 9. Email

- **Outbox:** domain transactions insert `email_jobs` rows. Each row has a deterministic idempotency key, e.g. `decision:<id>:author`, so retries and double submits create one job.
- **Dispatch:**
  - After the commit, the request schedules a dispatch.
  - The job runner retries failures with exponential backoff: 1, 5, 15 and 60 minutes, then 6 hours. Max 6 attempts, then `failed`.
  - The Resend `Idempotency-Key` header is the job key.
- **Statuses:**
  - `accepted` means the provider accepted the message.
  - `delivered`, `bounced` and complaints come only from signed webhooks.
  - Queued mail is never shown as delivered.
- **Webhooks:** `/api/webhooks/resend` verifies the Svix-format signature (HMAC-SHA256 over `id.timestamp.body`, 5-minute tolerance, constant-time compare) before recording events.
- **Content:** a status summary and a link to the application. Never manuscript text or internal notes.
- **Addresses:** `EMAIL_FROM` (verified sender domain), `EMAIL_REPLY_TO` and the public contact address are separate settings. The sender never spoofs an author.
- **Development:** the `dev` transport stores messages in the database and shows them at `/dev/mailbox`, with a banner saying nothing was sent. It cannot be selected in production.
- **Events covered:** verification, reset, application receipt and decision, submission receipt, new-submission and assignment notices to editors, author decisions (changes, accept, decline), publication notice.

## 10. Private storage

- **Uploads:** PDF or DOCX, up to 10 MB.
  - The type is checked by content: PDF magic `%PDF-`; DOCX is a ZIP containing `[Content_Types].xml` and `word/`.
  - The extension must match. Everything else is refused, including executables and macro-enabled `.docm`.
  - Stored under a random key, never under the user-supplied name. The filename is sanitized for display only.
- **Drivers:**
  - `local`: a directory outside the web root. For development and tests, or a single-instance host with a persistent volume.
  - `s3`: any S3-compatible bucket (AWS S3, Cloudflare R2, Supabase Storage). The bucket must be private.
- **Downloads:** go through `GET /api/attachments/:id`. The route authorizes the request, then streams the file (`local`) or redirects to a presigned URL valid for 60 seconds (`s3`).
- **Uploads are rate-limited.** Documents are never parsed or rendered on the server.

## 11. Rendering and sanitization

- **Format:** manuscripts are Markdown (CommonMark plus GFM footnotes), with a `:sc[...]` directive for small caps in citations.
- **No raw HTML:** it is not enabled. `rehype-sanitize` runs with a strict allowlist as defense in depth. Links allow `http`, `https` and `mailto` only.
- **Footnotes:** keep the journal's numbered notes with back-links. A small rehype step reshapes GFM output to match the original article markup.
- **Storage of rendered HTML:** happens at publish time into the immutable version, so readers never trigger rendering of unreviewed input.
- **Editor:** a textarea with a formatting toolbar and preview. Fully keyboard-usable. It is not WYSIWYG; that limitation is documented.

## 12. Security headers and other controls

- **CSP with per-request nonces** (set in the Next.js proxy):
  - `default-src 'self'`
  - fonts from Google Fonts
  - `frame-ancestors 'none'`
  - `form-action 'self'`
  - `object-src 'none'`
- **Other headers:**
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Content-Type-Options: nosniff`
  - `Permissions-Policy` (minimal)
  - HSTS in production
- **Indexing:** private routes send `noindex` and are disallowed in `robots.txt`.
- **Rate limits:**
  - Better Auth's limits (database storage) for sign-in, sign-up, verification resend and reset.
  - Application limits (database) for submissions, uploads and applications.
- **No server-side fetching of submitted URLs.**
- **Secrets:** read only on the server through `src/server/config.ts`. Never imported into client components (the `server-only` package enforces this).

## 13. Configuration and failure modes

- `src/server/config.ts` validates the environment with zod at startup (`instrumentation.ts`).
- **Production refuses to start without:**
  - `DATABASE_URL` (a `postgres://` URL, never PGlite)
  - `BETTER_AUTH_SECRET` (at least 32 characters)
  - `APP_URL` (https)
  - `EMAIL_TRANSPORT=resend` with `RESEND_API_KEY` and `EMAIL_FROM`
  - `STORAGE_DRIVER` with its settings
  - `CRON_SECRET`
- **Development:** without `DATABASE_URL`, uses PGlite at `.data/pglite`. Every page shows a "development" banner stating the database and mail are local.
- `GET /api/health` reports database reachability, migration level and which adapters are configured. It never reports secret values.

## 14. Migrations and seeds

- drizzle-kit generates SQL migrations into `drizzle/`. They are committed, applied with `npm run db:migrate`, and tested from an empty database in CI.
- Triggers and partial indexes are added in custom SQL migrations.
- `npm run db:seed:content` (idempotent, safe in production):
  - default settings
  - Volume I and Number 1 as **non-visible** planned records
  - CMS pages from the original copy
  - the original article as an **unpublished** manuscript with open publication checks
  - a draft meeting with the proposed motion and no date
- `npm run db:seed:demo`: synthetic demo accounts and manuscripts, refused when `NODE_ENV=production`.

## 15. Testing strategy

- **Vitest integration tests** run against a fresh in-memory PGlite with all migrations applied. They cover:
  - policies, the state machine, publication snapshots, concurrency
  - feedback versus internal notes, applications, last admin
  - outbox and retry, webhook signatures, rendering and XSS
  - uploads, config validation, health
- **Route handlers are called directly** with real Better Auth sessions (sign-up, then verify, then sign-in), to test direct API requests without the UI.
- **Playwright journeys** against a running server with an isolated PGlite directory and the development mailbox, plus screenshots at 320, 375, 768 and 1440px.

## 16. Hosting

The decision is pending the owner, and the app does not depend on it.

| Option | What it needs | Notes |
|---|---|---|
| **A: Node host with a persistent volume** (Render, Railway, Fly) | Managed Postgres, Resend, local storage on the volume, an in-process worker or cron | Fewest services. Single instance only if using local file storage. |
| **B: Vercel + Neon + S3-compatible storage (R2) + Resend** | Several accounts | Serverless. Cron frequency on free plans is limited, so retries also run after each request. |

Both options need the owner to create accounts, add secrets on the host (never in Git), verify a sending domain (SPF, DKIM, DMARC from the provider's instructions), and run `npm run admin:bootstrap` once.

## 17. Pass/fail checks

The stage gates in `docs/spec.md` §6 are the acceptance list. A stage is complete only when its listed checks have been run and recorded in `docs/verification.md`.
