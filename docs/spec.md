# Project spec: Pasadena Law & Policy Review application

## 1. Goal

Turn the static site into a working publication. Specifically:

- **Readers** read published work, issues, Forum pieces, meetings and submission requirements.
- **Members** sign up, verify their email, sign in, recover access and manage their accounts.
- **Authors** submit, revise and track their own manuscripts.
- **Editors** review and edit manuscripts and propose page changes.
- **Administrators** decide on applications and submissions, manage roles and publish.
- **Email** for account and editorial events goes through a real configured provider.
- **Nontechnical editors** run the publication without touching HTML or Git.

## 2. Two milestones (never merged into one claim)

1. **Implementation ready for review.** Functional, tested workflows with real persistence. Reviewed deployment configuration. Documented operations. A verified staging system, when hosting access exists.
2. **Public launch.** Additionally requires approved factual content, domain and hosting configuration, verified email deliverability, a real administrator, and production smoke tests.

## 3. Scope

**In:**
- Accounts: sign-up, verification, sign-in/out, recovery, profile, password change.
- Editorial applications.
- Roles: member, editor, admin, plus suspension.
- Manuscripts: drafts, preview, submission, revisions, withdrawal, private attachments (PDF/DOCX).
- Review: queue, assignment, two independent recommendations, author feedback separate from internal notes.
- Decisions, publication snapshots, unpublishing and rollback.
- Issues and Forum, meetings and minutes, CMS pages, masthead, settings.
- Transactional email with an outbox and delivery status.
- Audit log, rate limits, security headers, tests, CI, documentation.

**Out:** marketing newsletters, payments, comments by the public, full-text search beyond title/author/type filtering, scheduled publishing (unless a tested scheduler exists), a WYSIWYG editor (Markdown with a toolbar and preview instead).

## 4. Roles

| Role/state | Allowed |
|---|---|
| Visitor | Read public content; sign up; view guidelines and meetings |
| Unverified account | Verify email; request another link; recover access |
| Verified member (author) | Manage own account; create and submit own writing; see own decisions and author-visible feedback; apply to be an editor |
| Pending editorial applicant | Member permissions only; see own application status |
| Editor | Review queue; claim reviews; recommend; author-visible feedback and internal notes; editorial edits; propose page changes |
| Administrator | Everything editors can do, plus: members and applications, roles, suspension, assignments, decisions, publication, issues, meetings, pages, settings, email status, audit log |
| Suspended | Nothing protected; sees an account-status message |

**Membership rules:**
- Ordinary verified sign-up grants member access.
- An optional `membership_requires_approval` setting (default off) holds new members until an admin approves them. Reading published work never requires an account.

## 5. Workflows (summary; details in DESIGN.md)

- **Account:**
  - sign up with name, email and password
  - verification email (expiring, resend throttled)
  - sign in/out with generic errors
  - reset password (single-use, expiring, revokes sessions)
  - profile (public byline and bio separate from private fields)
  - change password
  - editorial application
- **Author:**
  - choose a type (Essay, Proposal, Note, Forum)
  - draft with title, deck, abstract, body with footnotes, and an optional bio
  - saved/unsaved indicator and a navigation guard
  - preview in journal typography
  - optional PDF/DOCX attachment
  - submit with confirmations
  - status and decisions
  - revise and resubmit
  - withdraw
- **Editor:**
  - queue filters (type, status, issue, assignment)
  - manuscript view (revisions, attachments, reviews, feedback, notes)
  - claim review
  - recommendation
  - author-visible feedback
  - internal notes
  - editorial edits with a diff and author attribution
  - page-change proposals
- **Admin:**
  - members (search, filter, role, suspend)
  - applications (approve/decline with a note)
  - assign or reassign reviewers
  - decisions (two recommendations required before accepting)
  - publication checks
  - publish (revision, slug, issue, byline, preview)
  - unpublish and restore a version
  - issues and order
  - meetings and minutes
  - page publication, masthead, settings
  - email status and retry
  - audit log

## 6. Acceptance checklist by stage

Each stage is complete only when every check below has been run and recorded in `docs/verification.md`.

- `[x]`: verified, with evidence in `verification.md`.
- `[ ]`: not done, with the reason given.

**S0: audit and design**
- [x] `docs/repo-audit.md`, `docs/spec.md` and `docs/DESIGN.md` committed.
- [x] The architecture matches the infrastructure that actually exists (no assumed credentials).
- [x] No source was replaced without explanation. `site/` is untouched. The old README moved to `docs/static-site-notes.md`.

**S1: foundation**
- [x] `npm ci`, `npm run build` and `npm start` work from a clean checkout.
- [x] Migrations apply to an empty database (PGlite and the `pg` driver path).
- [x] `/api/health` reports the database as up.
- [x] Public routes render with the original typography.
- [x] Old `.html` URLs redirect.
- [x] Production refuses to start with missing configuration (tested).
- [x] CI workflow committed. Its first GitHub run happens when the branch is pushed.

**S2: accounts and permissions**
- [x] Tests written first, then passing: sign-up grants only `member`; request bodies, profile updates and email domains cannot grant privilege.
- [x] Anonymous and unverified requests to private endpoints are denied.
- [x] Verification and reset tokens expire and cannot be replayed; reset revokes sessions.
- [x] Suspension and role revocation take effect on the next request.
- [x] The last active admin cannot be demoted or suspended.
- [x] Application approve/decline works and is audited.
- [x] Admin bootstrap refuses when an admin already exists.
- [x] No secrets are committed.

**S3: author submissions**
- [x] A complete author journey passes: draft, save, preview, submit, receipt, status, revise, resubmit, withdraw.
- [x] Another author cannot read, change or download the work (direct requests tested).
- [x] Drafts never appear in public routes.
- [x] Uploads are validated by content; executables and macro documents are refused.

**S4: review and decisions**
- [x] Invalid transitions return 409 or 422.
- [x] Self-review and self-decision are refused.
- [x] Acceptance requires two recommendations from two different non-author editors on the current revision.
- [x] Stale edits and stale decisions return a 409 Conflict with a usable message.
- [x] Internal notes never appear in author pages, author API responses or emails.

**S5: publication and CMS**
- [x] Publishing requires an accepted manuscript, a chosen revision and zero open checks.
- [x] Later edits do not change public text.
- [x] Unpublishing removes the piece from all public routes and indexes.
- [x] Restoring a previous version works.
- [x] Issue and Forum indexes list only live publications.
- [x] Footnote links work.
- [x] Page drafts don't change public pages until an admin publishes them.
- [x] Meetings show honest "not announced" states.
- [x] The masthead stays hidden until published.

**S6: email**
- [x] Each event creates one job (idempotency).
- [x] Retry and backoff behave deterministically; final failure is recorded.
- [x] Webhook signature verification rejects tampered or stale payloads.
- [x] The development mailbox shows messages and cannot run in production.
- [ ] Live delivery to an owner-specified test address. **Pending:** it needs a Resend account, a verified domain and DNS (`manual_todo.md` §3).

**S7: hardening**
- [x] Build and tests pass.
- [x] Accessibility checks pass: one `h1`, landmarks, labels, focus, contrast, no horizontal scroll at 320/375/768/1440.
- [x] Security headers present.
- [x] Private routes are `noindex`.
- [x] `npm audit` findings are recorded.
- [x] Backup and restore of the database and storage are documented and exercised locally.
- [ ] The same backup and restore on staging. **Pending:** hosting.

**S8: handoff**
- [ ] Pull request opened with evidence. **Pending:** GitHub refused the push because this machine's GitHub CLI login lacks the `workflow` scope, which pushing `.github/workflows/ci.yml` requires. The owner grants it once with `gh auth refresh -h github.com -s workflow`.
- [x] Launch checklist and smoke-test commands (`deployment.md`).
- [x] `docs/manual_todo.md` lists owner actions in dependency order.
- [x] Handoff document written.
- [ ] Verified staging deployment. **Pending:** a Netlify site, Neon database and secrets (`manual_todo.md` §2).

## 7. Known limitations

- **No hosting, database, email or storage credentials existed in this environment.** Staging deployment, live email and cloud backups are pending owner setup.
- **The editor is Markdown with a toolbar and preview,** not WYSIWYG.
- **Account deletion and data export** are handled by an administrator on request (`operations.md`). They're not self-service.
- **Search** is limited to the queue filters, the issue index and the Forum.
- **Resend's webhook field for the message id** (`data.email_id`) is confirmed only by the first live event (`email-setup.md`).
- **Per-IP rate limits** depend on one trusted header (`TRUSTED_IP_HEADER`, Netlify's by default). On another host it must be set to that proxy's header; otherwise every visitor shares one per-IP limit. Per-email limits apply either way.
- **PGlite (development only) is bundled into the server function.** This adds size but never runs in production.
- **Not measured:** Lighthouse performance, and real-device testing beyond Chrome at four widths.
