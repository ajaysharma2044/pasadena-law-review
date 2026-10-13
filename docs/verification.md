# Verification record

These results were recorded on Oct. 13, 2026, on branch `feature/journal-app`. The clean-checkout run used commit `309ef6c`. The browser suite's 22 tests ran at `51d98a8`, after the console check was added.

- **Machine:** macOS 26.0.1 (arm64), Node 22.19.0, npm 10.9.3
- **Browser:** Google Chrome (Playwright `channel: "chrome"`; CI uses Playwright's Chromium)
- **Database:** every run used PGlite, which is real Postgres compiled to WebAssembly. No hosted service was involved; none exists yet.

## Results

| Check | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | exit 0 |
| Integration tests | `npx vitest run` | 10 files, **108 passed**, exit 0 (about 30 s) |
| Production build | `npm run build` | exit 0, no warnings. 18 static pages; proxy (CSP) compiled. |
| Browser suite | `npx playwright test` (builds, seeds demo data, then `next start`) | **22 passed**, exit 0. The server logged **0 errors**; the run before the security fixes logged 2. |
| Clean checkout | fresh `git clone` of the branch at `309ef6c`, then `npm ci`, `tsc`, `vitest`, `playwright test e2e/http.spec.ts` | `npm ci` exit 0 (271 packages); tsc exit 0; 108/108; 8/8 |
| Accessibility | axe-core (WCAG 2.0 A/AA, 2.1 AA) on 14 screens | **0 violations** of any impact (`docs/screenshots/axe-findings.json`) |
| Layout | widths 320, 375, 768 and 1440 | no horizontal scrolling and exactly one `h1` on every checked page; 38 screenshots in `docs/screenshots/` |
| Keyboard | `e2e/http.spec.ts` | the skip link is the first Tab stop; every focused element has a visible outline of at least 2px; one `main`, plus header, nav and footer landmarks |
| Production config | `NODE_ENV=production` with nothing set | refused to load, with 7 named problems (below) |
| Attachment backup | scratch database: upload, `attachments:backup`, delete the object, `attachments:restore` | restored object's SHA-256 matched the upload and `manifest.json` (`84d685c0…3c177`) |
| Email runner | scratch database: `npm run jobs:run` | "No emails were due."; after queuing 2: `{ accepted: 2 }`; then "No emails were due." again |
| Dependencies | `npm audit` | 4 moderate, one advisory chain (below) |

### Integration tests by file

| File | Tests | Covers |
|---|---|---|
| `accounts.test.ts` | 23 | sign-up can't grant privileges; no account enumeration; verification and reset (expiry, single use, no auto sign-in); private endpoints; cross-site requests; roles and suspension on the next request; last-admin guard; bootstrap; rate limits; trusted IP header |
| `manuscripts.test.ts` | 22 | drafts and version conflicts; submission rules; ownership; withdrawal; self-review and self-decision; two-editor acceptance on the current revision; stale decisions; editors' edits as revisions; publication rules; immutable published copies; rollback; unpublishing; never-submitted pieces private; no acting on one's own work; closed submissions |
| `email.test.ts` | 13 | one job per idempotency key; retry schedule; final failure; permanent errors; overlapping runners; link redaction; Resend request and error handling; webhook signatures (valid, tampered, stale); replayed events |
| `markdown.test.ts` | 12 | footnotes with back-links; heading demotion; XSS and unsafe links; directives; excerpts |
| `attachments.test.ts` | 11 | content sniffing (PDF and DOCX accepted; DOCM, executables and mismatched names refused); access rules; size limit; Netlify Blobs API via a local Blobs server |
| `cms.test.ts` | 7 | content import (unpublished article, hidden issue, idempotent); page proposals stay private until published; meetings, time zones and roles; settings; masthead hidden until published; visible issues only |
| `config.test.ts` | 7 | production refusals; Netlify DB variable names; local-preview flag; `RATE_LIMITS=off` refused in production |
| `migrations.test.ts` | 6 | every table; idempotent; immutable revisions and audit log; meeting constraint; the same migrations over a real Postgres wire connection (`pg` driver through pglite-socket) |
| `http-boundaries.test.ts` | 6 | direct requests across ownership and roles; disguised uploads; preview sanitization; job-runner secret; redirect targets |
| `backup.test.ts` | 1 | database dump restored into a fresh database with identical rows |

### Browser suite

**`journeys.spec.ts`:**

- **Trace 1:** sign up, confirm by email, then sign in. Create and save a draft with a footnote, and submit it with the three confirmations. A receipt goes to the author and a notice to the editors. (Preview sanitization is tested in `http-boundaries.test.ts`.)
- **Trace 2:**
  - Editors ask for changes and the author resubmits.
  - Two editors recommend and an administrator accepts and publishes.
  - A later editors' edit leaves the public text unchanged.
  - Internal notes never reach the author.
- **Trace 3:** a declined applicant and a revoked editor are refused, in the UI and by direct requests.

**`screens.spec.ts`:** 10 tests covering 14 screens: public pages plus author, editor and admin pages. Each gets screenshots, overflow and `h1` checks, and axe.

**`http.spec.ts`:**

- legacy redirects (7, all 308)
- health endpoint (no settings revealed)
- security headers and a fresh CSP nonce on each request
- `noindex` on private pages, and `robots.txt`
- the keyboard checks above
- unpublished work returns 404; the job runner returns 401
- cross-site sign-in returns 403; private API without a session returns 401
- **RSC access tests:** anonymous visitors, members and editors requesting admin or editor pages as client navigations
- **browser console:** 18 page visits, plus client-side navigation and the editor's live preview, with no console errors, uncaught exceptions or CSP violations

### Production configuration refusal

Loading the configuration with `NODE_ENV=production` and nothing else set gave:

```text
- APP_URL is required in production
- APP_URL must use https in production
- DATABASE_URL (or NETLIFY_DATABASE_URL) is required in production; PGlite is development-only
- BETTER_AUTH_SECRET must be at least 32 characters in production
- EMAIL_TRANSPORT=dev is development-only; set EMAIL_TRANSPORT=resend in production
- STORAGE_DRIVER=local in production requires STORAGE_LOCAL_PERSISTENT=true (a persistent volume on a single instance); on Netlify use netlify-blobs
- CRON_SECRET is required in production (protects the job runner)
```

The app runs the same check at startup (`src/instrumentation.ts`).

## Security review

An independent reviewer read the whole codebase, including the installed Next.js and Better Auth sources. I confirmed each finding in the code before fixing it.

For each fix, a test was written first and seen failing:
- The **RSC leak** reproduced in a browser test. An anonymous request's response contained another member's email address.
- The **open redirect** reproduced as `Location: //evil.example` after sign-in.

| # | Severity | Finding | Fix | Test |
|---|---|---|---|---|
| 1 | High | Admin and editor pages relied on their layout for access. A client-navigation (RSC) request renders a page without its layout, so admin data (members, applications, email log, audit log, settings, draft meetings) could be read without signing in. | Every page checks access itself (`pageAccess`). Services behind private lists also check (`assertRole`). Inline admin queries moved to `services/admin.ts`. | `e2e/http.spec.ts` "page-level access on client navigations" (anonymous, member and editor) |
| 2 | Medium | A draft withdrawn before submission, and its files, became visible to editors. | Editors see only pieces submitted at least once (`currentRevisionId` set): queue, manuscript page and downloads. | `manuscripts.test.ts`, `attachments.test.ts` |
| 3 | Medium | Open redirect after sign-in: `next=/.//evil.example` passed the string check, then URL parsing turned it into `//evil.example`. | `safePath` judges the parsed URL; `redirectTo` refuses any Location that leaves the site or starts with `//`. | `http-boundaries.test.ts` "redirect targets" (8 variants, unit and through sign-in) |
| 4 | Low | An administrator could unpublish, restore, or manage the publication checks of their own manuscript. | Same "another administrator" rule as decide and publish. | `manuscripts.test.ts` |
| 5 | Low | Closing submissions was enforced only by the page. | The server refuses new drafts and first submissions while closed. Resubmissions still go through. | `manuscripts.test.ts` |
| 6 | Low | Login CSRF: the confirmation link signed in whoever opened it. | `autoSignInAfterVerification: false`. The confirmation page now asks the person to sign in. | `accounts.test.ts`; journeys updated |
| 7 | Low (self-hosting only) | Per-IP limits trusted client-supplied forwarding headers. | Only `TRUSTED_IP_HEADER` is read (Netlify's header by default; the last hop for `X-Forwarded-For`). Sign-up also gained a per-address limit. | `accounts.test.ts` |

**Also hardened in S8:** production refuses `RATE_LIMITS=off` (`config.test.ts`).

**Checked by the reviewer and found sound:**
- the same-origin check on every mutation
- the job-runner secret (timing-safe)
- webhook signatures and replay handling
- the narrowed auth catch-all and its callback validation
- no enumeration on sign-up, reset or resend
- session revocation
- API authorization
- authors never receive notes or rationales
- Markdown sanitization (every `dangerouslySetInnerHTML` goes through it)
- upload validation and download headers
- public pages read only published records
- production config refusals, CSP and HSTS
- parameterized SQL
- no self-granted privileges

## `npm audit`

`npm audit` reports 4 moderate findings, all from one advisory chain: GHSA-67mh-4wv8-2f99, in esbuild ≤ 0.24.2's development server. The path is:

`drizzle-kit` 0.31.11 → `@esbuild-kit/esm-loader` → `@esbuild-kit/core-utils` → `esbuild` 0.18.20

- `drizzle-kit` is the migration generator. It's a dev dependency, and also an optional peer of Better Auth, which is why `npm audit --omit=dev` lists it too.
- Nothing imports it at runtime, and esbuild's dev server is never started.
- The only automatic fix (`npm audit fix --force`) downgrades `drizzle-kit` to 0.18.1, which breaks migration generation. So it's left as is, to revisit when `drizzle-kit` drops `@esbuild-kit`.

## Not verified, and why

| Item | Why | When to check |
|---|---|---|
| Staging or production deployment on Netlify | No Netlify site, database or secrets exist (`manual_todo.md` §2) | Smoke tests in `deployment.md` after the first deploy |
| Live email through Resend, and the webhook's `data.email_id` field | No Resend account or verified domain | `email-setup.md` step 9 |
| Netlify Blobs on Netlify itself | Tested only against the local Blobs server from `@netlify/blobs` | First upload on staging |
| A hosted Postgres server (Neon) | Tested with PGlite, including over the Postgres wire protocol with the production `pg` driver | First deploy (migrations run in the build) |
| The scheduled email-retry function | Netlify runs scheduled functions on published deploys only | Netlify → Functions → `email-retry` → Run now |
| Backup and restore against Neon and Blobs | No hosting | `operations.md` |
| GitHub Actions CI | Its first run started when the branch was pushed on Oct. 13 | The checks on pull request #1 |
| Lighthouse performance, real phones and screen readers | Not run; accessibility was checked with axe and keyboard tests only | On staging |
