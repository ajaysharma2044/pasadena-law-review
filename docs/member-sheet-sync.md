# Private member roster in Google Sheets

The production scheduler mirrors the roster every hour, on the hour (UTC).
The database remains authoritative. Editing the Sheet does not change website accounts.
Only the `Members` and `Sync` tabs are maintained. Keep personal notes in another tab.

## Data

Member ID, name, email, email verification, role, status, join date, and latest retained
session creation time. Dates use ISO 8601 UTC. Session creation approximates sign-in time;
sessions that have been deleted or removed at sign-out cannot be reconstructed. This is
not a permanent login history or an accurate lifetime login count.

Passwords, hashes, verification tokens, session tokens, IP addresses, user agents and
manuscript contents are never selected or sent to Google. Values are written as literal
cells, so member names cannot inject spreadsheet formulas.

## One-time authorization

1. Use a Google Cloud project with the Google Sheets API enabled.
2. Create a dedicated service account, without project-wide IAM roles or domain-wide
   delegation. Create its JSON key. Keep the key private; never commit it or paste it
   into chat, a Sheet cell, or a public URL.
3. Share only the private roster spreadsheet with that service account's email as Editor.
   Leave general access Restricted. The service account has no access to other private
   files unless they are separately shared with it.
4. In this Netlify project's production environment, set:
   - `MEMBER_SHEET_ID`: the spreadsheet's ID, with `Members` and `Sync` tabs present.
   - `MEMBER_SHEET_GOOGLE_CREDENTIALS`: the entire service-account JSON, marked Secret,
     scoped to Functions and Runtime (or all scopes if scope selection is unavailable).
5. Redeploy after environment changes. Run `member-sheet-sync` from Netlify's Functions
   panel for an immediate first sync, or wait for the next hourly run.
6. Verify `Sync` says Connected and has a current last-successful-sync timestamp, and
   that Members matches the admin roster. A configured job that fails returns HTTP 502;
   its logs deliberately contain no credentials or member data. The last successful
   timestamp remains unchanged on failure.

Without both environment variables, the job reports `not_configured` and sends no data.
The API `/api/jobs/member-sheet-sync` accepts POST only with the existing CRON_SECRET
Bearer authorization; browser sessions do not grant access to this scheduler endpoint.

To stop syncing, remove both variables and redeploy, revoke the service account's
spreadsheet permission, and delete its key. Existing Sheet data is not erased by disabling
the job. Other Sheet tabs and website accounts are never modified by this integration.

## Validation

`npm run typecheck` and `npm test -- tests/member-sheet-sync.test.ts` check the data
allowlist, scheduler authorization, incomplete setup, and atomic literal-value writes.
An actual Google write must also be verified after the service account is configured.
