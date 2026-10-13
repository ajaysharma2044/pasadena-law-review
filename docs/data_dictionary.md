# Data dictionary

All tables live in one Postgres database. The schema is `src/server/db/schema.ts`; the migrations are in `drizzle/`. Times are stored in UTC (`timestamptz`) and shown in the publication's time zone. Meetings carry their own time zone.

Privacy column:
- **Private:** only the person, and the editors or administrators who need it.
- **Editorial:** editors and administrators only.
- **Public:** readers can see it once published.

## Accounts

| Table | Holds | Privacy | Notes |
|---|---|---|---|
| `user` | Name, email, email-confirmed flag | Private | Better Auth core table. Name is the private account name. |
| `account` | Password hash (scrypt, set by Better Auth) | Secret | Never read by application code. |
| `session` | Session tokens, expiry, IP address, user agent | Secret | Deleted on sign-out, password reset and suspension. |
| `verification` | Reset tokens and their expiry | Secret | Single use; deleted when used. |
| `rate_limit` | Better Auth's own counters (unused; its limiter is off because the app applies its own) | Internal | |
| `memberships` | Role (`member`, `editor`, `admin`), status (`pending`, `active`, `suspended`), suspension reason | Editorial | **The only source of privileges.** Never writable by profile or sign-up requests. |
| `author_profiles` | Public byline name and bio | Public on published work | Separate from private account fields. |
| `editorial_applications` | Statement, experience, status, decision note | Private to applicant and administrators | At most one pending per person. |

No student ID numbers, grades or transcripts are collected anywhere.

## Manuscripts and review

| Table | Holds | Privacy | Notes |
|---|---|---|---|
| `manuscripts` | Owner, kind, status, the author's working copy, `version` for conflict detection, `current_revision_id` | Private to author; editorial after submission | `author_id` is null only for content imported from the old site (`attribution_note` explains). |
| `manuscript_revisions` | Immutable copies: each submission, each editors' edit, the import | Same | A trigger forbids edits and deletes. `created_by` records who made an editors' edit. |
| `review_assignments` | Which editors review which manuscript | Editorial | |
| `review_recommendations` | One recommendation per editor per revision, with rationale | **Editorial only** | Rationales never reach authors. |
| `author_feedback` | Comments meant for the author | Private to author and editors | The only review text authors see. |
| `internal_notes` | Editors' private notes | **Editorial only** | Never read by author pages, author API responses or email templates (tested). |
| `editorial_decisions` | Accept, request changes, decline, reopen, with the author-visible note and who decided | Note visible to author; decider is editorial | |
| `publication_checks` | Things to verify before publishing | Editorial | Publishing is blocked while any is open. |
| `attachments` | Original filename (cleaned), type, size, SHA-256, random storage key | Private to author and editors | File bytes live in Blobs or S3 or local disk, never in the database. |

## Publication

| Table | Holds | Privacy | Notes |
|---|---|---|---|
| `publications` | Slug, kind, issue, order, state (`live` / `unpublished`), current version | Public when live | One per manuscript. |
| `publication_versions` | Immutable snapshot: title, deck, abstract, byline, bio, sanitized HTML, who published and when | Public when current and live | A trigger forbids edits and deletes. Rollback switches the pointer. |
| `volumes`, `issues` | Numbering, term, visible flag, order | Public when visible | |
| `meetings` | Status, time and time zone, place, motion, openers, who can come, minutes, minutes-published flag, `version` | Public when announced (minutes when published) | |
| `cms_page_versions` | Page text versions: draft, proposed, published, superseded, rejected | Public when published | At most one published version per page. |
| `site_settings` | Name, tagline, contact email, Instagram, time zone, front lead, masthead and membership switches | Public where shown | Also holds the `_seed_content_v1` marker. |
| `masthead_entries` | Role and real name | Public only when the masthead is published | |

## Operations

| Table | Holds | Notes |
|---|---|---|
| `email_jobs` | Recipient, subject, plain-text body, status, attempts, next attempt, last error, provider id, idempotency key | Confirmation and reset links are removed from the body after sending. |
| `email_events` | Provider webhook events (by Svix id) | Duplicates are ignored. |
| `audit_events` | Who did what to which record, plus small non-sensitive details | Immutable. Never contains passwords, tokens or manuscript text. |
| `app_rate_limits` | Fixed-window counters per key (IP, email or account) | Safe to clear. |

## Retention

See `operations.md` → Retention and deletion.
