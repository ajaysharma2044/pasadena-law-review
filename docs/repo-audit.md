# Repository audit (S0)

Inspected Oct. 13, 2026, on the owner's Mac. Local checkout: `law-review/`. Branch `main` at `c2b08d5`, in sync with `origin/main` (GitHub `ajaysharma2044/pasadena-law-review`, private). Work continues on `feature/journal-app`.

## Execution environment

| Item | Value |
|---|---|
| OS | macOS 26.0.1, arm64, 12 CPUs, 18 GB RAM, 67 GB free disk |
| Runtime | Node 22.19.0, npm 10.9.3 |
| Not installed | pnpm, yarn, bun, Docker/Colima/Podman, PostgreSQL (server or client), Homebrew; Supabase, Vercel, Fly, Railway, Render, Netlify and Wrangler CLIs |
| Browsers | Google Chrome (used for browser tests) |
| GitHub | `gh` logged in as `ajaysharma2044` with `repo` scope |

## Credentials (presence only, never values)

- No environment variables for a database, email provider, object storage or host.
- No config files for Vercel, Supabase, AWS, Railway, Netlify, Wrangler or Neon.
- A `~/.fly` directory exists, but `flyctl` is not installed. It is not used.
- **Consequence:** this session cannot verify a staging deployment, live email delivery or cloud storage. Those stay pending; see `manual_todo.md`.

## What the repository contained

| Path | Contents |
|---|---|
| `site/` | 7 static HTML pages, `css/site.css`, `favicon.ico`, `apple-touch-icon.png`. No JavaScript. |
| `SPEC.md` | Visual and editorial spec for the static site, with an AI-tell checklist. |
| `README.md` | Placeholder list, renaming, free hosting notes. |
| `research/` | Notes and screenshots of the three reference sites. |
| `audit/` | Checks, screenshots and report for the **static** site. Historical evidence only. |

There was no backend, CMS, database, authentication, CI, test suite, package manifest or deployment configuration.

## Static routes

| URL | Content | Issues |
|---|---|---|
| `/index.html` | Lead piece ("A Second Draft" excerpt), next-meeting note, submissions note | Meeting facts are placeholders. It presents an unverified article as the lead. |
| `/issues.html` | Volume I, Number 1 contents (1 piece, "In preparation"); Number 2; Forum (empty) | Reading date is a placeholder. |
| `/articles/a-second-draft.html` | Full article, 6 notes plus an author note, "Cite as" line | Author unknown; see article blockers below. |
| `/meetings.html` | Next meeting, how a meeting runs, proposing a motion, minutes (empty) | Date, room, openers and email are placeholders. |
| `/submissions.html` | Email-based submission instructions, lengths, two-editor review | The submission address is a placeholder, and the flow is email-only. |
| `/about.html` | Description, independence statement, contact | Email is a placeholder. |
| `/masthead.html` | Six role lines, all `[Name]` | Deliberately not linked from any page. |

## Checks run

- **Internal links and anchors:** all resolve (re-verified in S0).
- **Placeholders:** 37 gray `[bracketed]` placeholders: about 3, article 5, index 5, issues 4, masthead 9, meetings 7, submissions 4.
- **External resources:** Google Fonts only (Old Standard TT, Charis SIL, Libre Franklin).
- **Old checks script:** not present in this session. `audit/checks.txt` (32/32) applies to the static site only and is **not** evidence for the new application.

## Implemented versus missing (against the new brief)

- **Implemented:** public reading pages (static), the typographic system, honest empty states, article footnotes with back-links.
- **Missing:**
  - accounts, verification, recovery, roles, editorial applications
  - submissions, review, decisions, publication management
  - CMS, structured meetings and issues, email, private storage
  - tests, CI, deployment configuration

## Unverified content and blockers carried forward

"A Second Draft" (the user's own proposal) is **not** cleared for publication:

- Author name and permission to publish; author's note; any disclosure about the prototype resource the original draft mentioned.
- The author's personal account (intentionally not written by anyone else).
- Exact counts and named districts from the 13-district AP 5520 review. The original research files no longer exist.
- Footnotes 2–5 rely on that review and need checking against the source PDFs. Footnotes 1 and 6 cite the Education Code and Title 5 and need checking.
- PCC's own AP 5520 / academic-integrity policy, cited by number.

Site-wide unknowns (final name, emails, meeting facts, editors, faculty advisor, club status) are listed in `manual_todo.md`.

## Migration decisions

1. **App location:** the application lives at the repository root (Next.js, `src/`). `site/` stays unchanged as the legacy reference. It is not served.
2. **Redirects:** old URLs redirect permanently (308).
   - `/index.html` → `/`
   - `/issues.html` → `/journal`
   - `/meetings.html` → `/meetings`
   - `/submissions.html` → `/submissions`
   - `/about.html` → `/about`
   - `/masthead.html` → `/masthead`
   - `/articles/a-second-draft.html` → `/articles/a-second-draft`
3. **Visual system:** the color tokens, fonts and layout widths of `site/css/site.css` move into the app stylesheet. Article setting and footnote behavior are preserved.
4. **"A Second Draft":** migrates as an **unpublished** manuscript with no author account, attribution pending, and open publication checks. Its URL shows "not published" (404) until an administrator resolves the checks and publishes it.
5. **CMS pages:** About, Submissions and Meetings copy seeds the CMS. The submission guidance changes from "email us" to the account-based flow it now describes. Factual unknowns become honest empty states, not placeholders in brackets.
6. **Masthead:** renders only when an administrator publishes a roster of real appointments.
7. **History:** `research/` and `audit/` are kept as historical evidence.
