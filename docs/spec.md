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

**S0: audit and design**
- [ ] `docs/repo-audit.md`, `docs/spec.md` and `docs/DESIGN.md` committed.
- [ ] The architecture matches the infrastructure that actually exists (no assumed credentials).
- [ ] No source was replaced without explanation.

**S1: foundation**
- [ ] `npm ci`, `npm run build` and `npm start` work from a clean checkout.
- [ ] Migrations apply to an empty database (PGlite and the `pg` driver path).
- [ ] `/api/health` reports the database as up.
- [ ] Public routes render with the original typography.
- [ ] Old `.html` URLs redirect.
- [ ] Production refuses to start with missing configuration (tested).
- [ ] CI workflow committed.

**S2: accounts and permissions**
- [ ] Tests written first, then passing: sign-up grants only `member`; request bodies, profile updates and email domains cannot grant privilege.
- [ ] Anonymous and unverified requests to private endpoints are denied.
- [ ] Verification and reset tokens expire and cannot be replayed; reset revokes sessions.
- [ ] Suspension and role revocation take effect on the next request.
- [ ] The last active admin cannot be demoted or suspended.
- [ ] Application approve/decline works and is audited.
- [ ] Admin bootstrap refuses when an admin already exists.
- [ ] No secrets are committed.

**S3: author submissions**
- [ ] A complete author journey passes: draft, save, preview, submit, receipt, status, revise, resubmit, withdraw.
- [ ] Another author cannot read, change or download the work (direct requests tested).
- [ ] Drafts never appear in public routes.
- [ ] Uploads are validated by content; executables and macro documents are refused.

**S4: review and decisions**
- [ ] Invalid transitions return 409 or 422.
- [ ] Self-review and self-decision are refused.
- [ ] Acceptance requires two recommendations from two different non-author editors on the current revision.
- [ ] Stale edits and stale decisions return a 409 Conflict with a usable message.
- [ ] Internal notes never appear in author pages, author API responses or emails.

**S5: publication and CMS**
- [ ] Publishing requires an accepted manuscript, a chosen revision and zero open checks.
- [ ] Later edits do not change public text.
- [ ] Unpublishing removes the piece from all public routes and indexes.
- [ ] Restoring a previous version works.
- [ ] Issue and Forum indexes list only live publications.
- [ ] Footnote links work.
- [ ] Page drafts don't change public pages until an admin publishes them.
- [ ] Meetings show honest "not announced" states.
- [ ] The masthead stays hidden until published.

**S6: email**
- [ ] Each event creates one job (idempotency).
- [ ] Retry and backoff behave deterministically; final failure is recorded.
- [ ] Webhook signature verification rejects tampered or stale payloads.
- [ ] The development mailbox shows messages and cannot run in production.
- [ ] Live delivery to an owner-specified test address — **pending until credentials and DNS exist**.

**S7: hardening**
- [ ] Build and tests pass.
- [ ] Accessibility checks pass: one `h1`, landmarks, labels, focus, contrast, no horizontal scroll at 320/375/768/1440.
- [ ] Security headers present.
- [ ] Private routes are `noindex`.
- [ ] `npm audit` findings are recorded.
- [ ] Backup and restore of database and storage are documented. They have been exercised locally; staging is pending hosting.

**S8: handoff**
- [ ] Pull request opened with evidence.
- [ ] Launch checklist and smoke-test commands.
- [ ] `docs/manual_todo.md` lists owner actions in dependency order.
- [ ] Handoff document written.

## 7. Known limitations (updated as found)

- No hosting, database, email or storage credentials exist in this environment. Staging deployment and live email are pending owner setup.
- The editor is Markdown with a toolbar, not WYSIWYG.
