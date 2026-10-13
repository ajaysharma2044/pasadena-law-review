# Deployment (Netlify)

Status: **prepared, not deployed.** No Netlify site, database, email provider or domain is connected yet. Every step below is something the owner does once, and nothing here was verified against a live deployment. The checks at the end are what to run when it is.

## What runs where on Netlify

| Piece | Netlify feature |
|---|---|
| Pages, route handlers, auth | Next.js runtime (OpenNext adapter), installed automatically. Pages and `/api/*` run as Netlify Functions. |
| `src/proxy.ts` (CSP nonce) | Netlify Edge Function (automatic). No filesystem or Node-only APIs are used there. |
| Database | Postgres through `DATABASE_URL`. Recommended: a Neon project (free tier). Netlify's own Netlify Database runs only on Netlify's credit-based plans (per Netlify's docs, Oct. 2026). |
| Attachments | Netlify Blobs store `manuscript-attachments` (private to the site, strong consistency). `STORAGE_DRIVER=netlify-blobs`. |
| Email | Resend over HTTPS (`EMAIL_TRANSPORT=resend`). |
| Email retries | `netlify/functions/email-retry.mts`, a scheduled function (every 5 minutes, published deploys only) calling `POST /api/jobs/run` with `CRON_SECRET`. |
| Migrations and content | `npm run db:migrate`, then `npm run db:seed:content` (one-time, marker-guarded), in the build command (`netlify.toml`), before `next build`. |

## One-time setup

1. **Create the database.**
   - Create a Neon project in **AWS US East (Ohio)** (`aws-us-east-2`). That's next to Netlify's default functions region, US East (Ohio), so each query makes a short trip. Neon's and Netlify's docs both list these, as of Oct. 2026.
   - Copy two connection strings: the **pooled** one (for the app) and the **direct** one (for migrations).
2. **Create the Netlify site** from the GitHub repository `ajaysharma2044/pasadena-law-review`.
   - Build settings come from `netlify.toml`; don't override them.
   - Set the production branch to `main` only after the pull request is merged.
3. **Environment variables** (Site configuration → Environment variables). Never put these in Git or in an issue.
   - Set each one for the **Production** deploy context only. Otherwise pull-request previews would build and run against the live database.
   - Previews then show the "missing settings" error instead, which is safe.

   | Variable | Value |
   |---|---|
   | `APP_URL` | Leave unset on Netlify. The app uses `URL`, which Netlify provides at runtime: the site's main address, including a custom domain once you add one. |
   | `DATABASE_URL` | Neon pooled connection string |
   | `DATABASE_URL_UNPOOLED` | Neon direct connection string (used by migrations and operator scripts) |
   | `BETTER_AUTH_SECRET` | 32+ random characters: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
   | `EMAIL_TRANSPORT` | `resend` |
   | `RESEND_API_KEY` | From Resend (see `email-setup.md`) |
   | `EMAIL_FROM` | e.g. `The Pasadena Law & Policy Review <editors@mail.your-domain.org>` on the verified domain |
   | `EMAIL_REPLY_TO` | The editors' real inbox (optional) |
   | `RESEND_WEBHOOK_SECRET` | From the Resend webhook you create (optional but recommended) |
   | `STORAGE_DRIVER` | `netlify-blobs` |
   | `CRON_SECRET` | 24+ random characters (same command as above) |
   | `RATE_LIMITS` | `on` |

   Do **not** set these on Netlify:
   - `PLR_LOCAL_PREVIEW`
   - `TRUSTED_IP_HEADER`, because the default is Netlify's own client-IP header.
4. **Deploy.**
   - The build runs migrations, then builds.
   - If a required variable is missing, every request returns 500, and the function log lists exactly which settings are missing. The app never falls back to development services in production.
5. **The original content is imported automatically** by the first production build (`npm run db:seed:content` in `netlify.toml`).
   - It imports the About, Submissions and Meetings copy, the hidden Volume I planning record, a draft meeting, and "A Second Draft" as an **unpublished** manuscript with open checks.
   - It records a marker and skips itself on every later build, so nothing is overwritten.
6. **Create the first administrator.**
   1. Sign up on the live site with your own email and confirm it.
   2. Run:
      ```bash
      DATABASE_URL="<direct connection string>" npm run admin:bootstrap -- you@your-domain.org
      ```
   - It refuses if an administrator already exists, and refuses unconfirmed accounts.
7. **Custom domain** (optional, needs a domain you own): Netlify → Domain management. Netlify issues the HTTPS certificate. Then:
   - redeploy, so the app picks up the new main address
   - update the Resend webhook URL

## Rollback

- **Code:** Netlify → Deploys → pick the previous deploy → "Publish deploy". Migrations are additive in this release. If a future migration isn't backward-compatible, restore the database (see `operations.md`) to the time before that deploy.
- **Content:** published articles have version history. "Make this live" on an earlier version, or "Unpublish", in the manuscript page.

## Smoke tests after any deploy

Run against the deployed URL:

```bash
curl -s https://<site>/api/health
```

Expect:
- `"status":"ok"`
- `"mode":"production"`
- `"driver":"postgres"`
- `"transport":"resend"`
- `"storage":{"driver":"netlify-blobs"}`
- `"jobsRunnerProtected":true`
- `migrationsApplied` of at least 2

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<site>/articles/a-second-draft
```

Expect 404: it stays unpublished until checks are resolved.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<site>/api/jobs/run
```

Expect 401 without the secret.

Then in a browser:
1. Sign up with a test address you control, confirm by email, start and submit a draft, and check the receipt email arrives.
2. As the administrator, check Admin → Email shows the messages as "Accepted" and, with the webhook configured, "Delivered".

## Known limits

- Netlify Functions have short time limits. The job runner sends at most 10 emails per call, and the scheduler calls it every 5 minutes. Mail is also sent right after each request (`after()`).
- Uploads are capped at 10 MB, which fits within request size limits.
- PGlite is bundled with the server code because the database client imports it, even though production never uses it. If the function bundle size becomes a problem, make that import lazy.
