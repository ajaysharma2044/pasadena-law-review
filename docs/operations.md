# Operations

## Monitoring

- **Health:**
  ```bash
  curl https://<site>/api/health
  ```
  It returns:
  - database reachability
  - the number of applied migrations
  - which email, storage and job adapters are configured

  Status 503 means the database is unreachable. Point any uptime checker at it. Netlify's own monitoring can do this, as can a free external pinger.
- **Logs:** Netlify → Logs → Functions.
  - Unexpected errors are logged with a stack trace, and the user sees a generic message.
  - Configuration errors list each missing setting.
- **Admin overview** (`/admin`) counts:
  - manuscripts in progress
  - pending applications
  - accounts waiting for approval
  - proposed page changes
  - emails that failed or bounced
- **Audit log** (`/admin/audit`): role and status changes, decisions, publication actions, page and settings changes. Entries can't be edited or deleted (a database trigger enforces this).

## Email queue problems

| Symptom | Cause | What to do |
|---|---|---|
| Jobs stay **Queued** | The scheduled function isn't running (only runs on published deploys) or `CRON_SECRET` differs between the function and the site | Netlify → Functions → `email-retry` → "Run now"; check its log; make sure `URL` and `CRON_SECRET` are set |
| Many **Failed** with "Resend 403" | Sender domain not verified or `EMAIL_FROM` not on it | Fix the domain or `EMAIL_FROM`, then Retry in Admin → Email |
| **Failed** with "Resend 429" after all attempts | Provider rate limit | Retry later; consider a higher Resend plan only with the owner's approval |
| **Bounced** | Bad recipient address | Ask the person to correct their email; don't keep retrying |
| Never **Delivered**, always **Accepted** | Webhook not configured | See `email-setup.md` step 8 |

## Backups

**Database (Postgres on Neon):**
- Neon keeps point-in-time restore history. The window depends on your Neon plan; check it in the Neon console.
- For an extra copy you control, take a logical dump with PostgreSQL's `pg_dump` (from a machine with the PostgreSQL client installed):
  ```bash
  pg_dump --format=custom --no-owner "$DATABASE_URL_UNPOOLED" > plr-$(date +%F).dump
  ```
- Restore into an empty database:
  ```bash
  pg_restore --no-owner --dbname "$TARGET_DATABASE_URL" plr-YYYY-MM-DD.dump
  ```

**Attachments (Netlify Blobs):** object keys are recorded in the database, so back up the database first. Then run from a laptop that has the site's Blobs credentials:

```bash
NETLIFY_BLOBS_SITE_ID=... NETLIFY_BLOBS_TOKEN=... STORAGE_DRIVER=netlify-blobs DATABASE_URL_UNPOOLED=... npm run attachments:backup -- ./backups/$(date +%F)
```

- `attachments:restore` with the same arguments puts them back. It skips objects that already exist.
- The backup writes a `manifest.json` with each object's SHA-256 so files can be checked.

**Verified locally:**
- a PGlite data-directory dump restored with identical rows (`tests/backup.test.ts`)
- an attachment backed up and restored into an empty store with a matching SHA-256 (`docs/verification.md`)

**Not verified:** backup and restore against Neon and Netlify Blobs. There is no hosting yet.

**Suggested schedule:** a database dump weekly and before every risky change, plus an attachment backup monthly. Keep copies off the laptop (for example, a private cloud drive the editors control).

## Retention and deletion

- **Accounts:** there's no self-service account deletion in this release. To remove someone:
  1. An administrator suspends the account, which ends all sessions.
  2. The operator deletes the `user` row only if they have no manuscripts. Revisions, decisions and audit entries keep the history, with the person's id set to null.

  Manuscripts by an author can't be deleted. They're withdrawn instead, and the history stays.
- **Withdrawn or declined manuscripts:** kept for the editorial record. If an author asks for removal, decide case by case and record the decision. This isn't automated.
- **Attachments:**
  - "Remove" marks the record deleted and deletes the stored object.
  - Attachments on withdrawn or declined pieces stay until someone removes them.
- **Email jobs:** kept for the delivery record. Confirmation and reset links are stripped from stored mail once sent. Old jobs can be deleted periodically:
  ```sql
  DELETE FROM email_jobs WHERE created_at < now() - interval '1 year';
  ```
- **Rate-limit counters** can be cleared at any time (`DELETE FROM app_rate_limits;`).
- **What to tell members:** a privacy statement for members is an owner task (`manual_todo.md`).

## Incident basics

1. **Something is publicly wrong:**
   - Unpublish the article, or make an earlier version live, from the manuscript page. Both take effect immediately.
   - Page text: publish the previous version from Editor → Pages.
2. **An account is misused:** suspend it in Admin → Members. Its sessions end immediately.
3. **A secret leaked:**
   - Rotate it in Netlify (`BETTER_AUTH_SECRET` rotation signs everyone out) and redeploy.
   - For Resend, revoke the old key in the Resend dashboard.
4. **Bad deploy:** Netlify → Deploys → publish the previous deploy.
5. **Afterwards:** write down what happened in the editors' records; the audit log has the timeline.
