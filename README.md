# Pasadena City College Law Journal

The website and editorial system for a student law and policy journal at Pasadena City College that also holds meetings.

- **Readers** see published essays, proposals, notes and Forum pieces, the issues, meetings and minutes, and the submission guidelines. They don't need an account.
- **Members** sign up, confirm their email, and write, preview, submit, revise and withdraw their own pieces.
- **Editors** work a review queue. They leave comments for the author and private notes for each other, recommend a decision, edit the text as a new version, and propose page changes.
- **Administrators** approve editors, assign reviews and decide. They publish fixed copies of approved text and can roll back or unpublish them. They also run the issues, meetings, pages, masthead, settings, email status and audit log.

Status: **implementation ready for review; production launch pending.** Nothing is deployed yet. `docs/manual_todo.md` lists what the owner still has to do, in order.

## Stack

| Layer | What |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript, Node 22 |
| Database | PostgreSQL with Drizzle ORM and SQL migrations (`drizzle/`). Locally and in tests: PGlite, a real Postgres engine that runs in-process, with no Docker. |
| Accounts | Better Auth: email and password, email confirmation, password reset, database sessions. Roles live in the app's own `memberships` table. |
| Email | Transactional outbox with retries. Resend in production, a local mailbox in development. |
| Files | Private attachments on Netlify Blobs (or S3-compatible storage, or local disk) |
| Hosting | Netlify (see `docs/deployment.md`) |
| Tests | Vitest (integration, against real Postgres semantics), Playwright and axe (browser journeys, accessibility, screenshots) |

## Run it locally

You need Node 22. No database or accounts are needed.

```bash
npm ci
```

```bash
npm run db:seed:demo
```

```bash
npm run dev
```

Then open http://localhost:3000.

- **First run:** creates a local database in `.data/` and imports the original site's content.
- **`db:seed:demo`:**
  - adds three synthetic accounts: `admin@demo.test`, `editor1@demo.test` and `editor2@demo.test`
  - their shared local password is set in `scripts/seed-demo.ts`, or by `DEMO_PASSWORD`
  - run it while the dev server is stopped, because only one process can open the local database
  - it refuses to run against anything but the local database
- **Email:** messages are never sent. They appear at http://localhost:3000/dev/mailbox, which is where you'll find confirmation links.
- **Banner:** every page shows a development banner.

To try production settings, copy `.env.example` to `.env.local` and fill it in. Never commit it.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Integration tests (Vitest) |
| `npm run test:e2e` | Browser journeys, accessibility checks and screenshots (Playwright; builds the app first) |
| `npm run typecheck` | TypeScript |
| `npm run db:migrate` | Apply migrations (`DATABASE_URL`, or the direct `DATABASE_URL_UNPOOLED`) |
| `npm run db:generate` | Write a new migration after changing `src/server/db/schema.ts` |
| `npm run db:seed:content` | Import the original pages, the draft meeting and "A Second Draft" (unpublished). Safe to run twice |
| `npm run admin:bootstrap -- <email>` | Make a confirmed account the first administrator. Refuses if one exists |
| `npm run jobs:run` | Send any due emails now (normally a scheduled function does this) |
| `npm run attachments:backup -- <folder>` / `attachments:restore` | Copy attachment files out of or back into storage |

## Where things are

| Path | What |
|---|---|
| `src/app/` | Pages and API routes (`/api/*`) |
| `src/server/` | Configuration, database, accounts, permissions, services, email, storage, Markdown rendering |
| `src/proxy.ts` | Per-request Content Security Policy |
| `drizzle/` | SQL migrations, including integrity triggers |
| `tests/`, `e2e/` | Integration and browser tests |
| `netlify.toml`, `netlify/functions/` | Netlify build and the email retry schedule |
| `site/` | The original static site, kept for reference. Its old URLs redirect to the new pages. |
| `SPEC.md`, `research/`, `audit/` | The static site's spec, design research and audit |

## Documentation

| File | For |
|---|---|
| `docs/manual_todo.md` | **Owner: start here.** Everything left to launch, in order |
| `docs/editor-guide.md` | Editors and administrators using the site |
| `docs/deployment.md` | Netlify, database, environment variables, smoke tests, rollback |
| `docs/email-setup.md` | Resend, sending domain, SPF/DKIM/DMARC, webhook |
| `docs/operations.md` | Monitoring, backups, retention, incidents |
| `docs/verification.md` | What was tested, how, and the results |
| `docs/spec.md`, `docs/DESIGN.md` | Scope, roles, acceptance checklist; architecture and security design |
| `docs/data_dictionary.md` | Every table, what it holds and who can see it |
| `docs/repo-audit.md` | The starting point (S0) |
| `docs/handoff_2026-10-13.md` | State of the work and how to resume |
| `docs/ideas.md` | Possible later features |
| `docs/static-site-notes.md` | The static site's original README (content notes) |
