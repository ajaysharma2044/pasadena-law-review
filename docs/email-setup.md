# Email setup (Resend)

Status:
- **Done:** code, tests and the development mailbox.
- **Pending:** live delivery. It needs a Resend account, a domain you control, and DNS access.

## What the site sends

| Event | Recipient | Kind (in Admin → Email) |
|---|---|---|
| Sign-up confirmation link | New member | `verify_email` |
| Password reset link | Member | `reset_password` |
| Editor application received / decided | Applicant | `application_received`, `application_decided` |
| Submission receipt | Author | `submission_received` |
| New submission or resubmission | Active editors (or assigned reviewers for a resubmission) | `new_submission` |
| Reviewer assigned | That editor | `review_assigned` |
| Changes requested / accepted / declined | Author | `decision_request_changes`, `decision_accept`, `decision_decline` |
| First publication | Author | `published` |

Emails carry a status summary and a link back to the site. They never include manuscript text or internal editorial notes. Confirmation and reset links are removed from the stored copy once Resend accepts the message.

## How delivery works

1. **Queued.** The action that triggers an email (for example, a decision) writes a job to the `email_jobs` table in the same database transaction, so either both happen or neither does.
2. **Sent.** Right after the request finishes, the site sends queued jobs. The scheduled function also runs every 5 minutes for anything left over.
3. **Retried.**
   - Temporary failures (rate limits, provider errors, network) are retried after 1, 5, 15 and 60 minutes and then 6 hours; after the sixth attempt the job is marked **Failed**.
   - Permanent failures (invalid address, unverified sender) fail at once.
   - An administrator can retry a failed job from Admin → Email.
4. **Statuses.**
   - **Queued** means not sent yet.
   - **Accepted** means Resend took it.
   - **Delivered**, **Bounced** and **Marked as spam** come only from Resend's signed webhooks.
   - The site never shows queued mail as delivered.
5. **Idempotency.** Each job has a unique key (for example `decision:<id>:author`), sent to Resend as `Idempotency-Key`. Double clicks and retries produce one email.

## Setup steps (owner)

1. **Create a Resend account** at resend.com.
2. **Add a sending domain.**
   - Resend recommends sending from a subdomain to isolate your sending reputation, e.g. `mail.your-domain.org`.
   - In Resend, go to Domains, then Add domain.
3. **Add the DNS records Resend shows** for that domain to your DNS provider. Resend lists each record's type, host name and value on the domain's page. Copy them exactly from there, not from this document; the values are unique to your domain.
   - These records set up SPF (which servers may send for the domain) and DKIM (a signature proving the mail is yours).
4. **Wait for Resend to show the domain as Verified.**
5. **DMARC.** After verification, add a DMARC policy: a TXT record at `_dmarc.<your domain>`.
   - Start with a monitoring-only policy, then tighten it once reports show mail passing.
   - Follow Resend's DMARC guidance for the record value.
6. **Create an API key** with sending access only. Put it in Netlify as `RESEND_API_KEY`.
7. **Set the sender** `EMAIL_FROM` to an address on the verified domain, e.g. `The Pasadena Law & Policy Review <editors@mail.your-domain.org>`.
   - Set `EMAIL_REPLY_TO` to the inbox the editors actually read.
   - The public contact address on the site is a separate setting (Admin → Settings).
8. **Webhook (recommended)** so the site can show Delivered and Bounced:
   1. In Resend, go to Webhooks and add an endpoint at `https://<your site>/api/webhooks/resend`.
   2. Subscribe at least to `email.delivered`, `email.bounced`, `email.complained`, `email.failed` and `email.suppressed`.
   3. Put the signing secret in Netlify as `RESEND_WEBHOOK_SECRET` and redeploy.
   - Requests are verified with the `svix-id`, `svix-timestamp` and `svix-signature` headers over the raw body, with a 5-minute window. Anything unsigned or stale is rejected.
9. **Test with a recipient you own.**
   - Sign up with a second address of yours, confirm, and submit a test draft.
   - Check Admin → Email shows Accepted, then Delivered.
   - Don't test on real students' addresses.

### Unconfirmed until the first live test

The site reads the Resend message id from `data.email_id` in webhook events. Check one delivered event in Resend's webhook log to confirm that field name. If it differs, update `src/server/email/webhook.ts`.

## Development and tests

- **Locally**, `EMAIL_TRANSPORT=dev` stores messages in the database and shows them at `/dev/mailbox`, under a banner saying nothing was sent. Production configuration refuses this transport.
- **Automated tests** cover:
  - idempotency
  - the retry schedule
  - final failure
  - permanent errors
  - overlapping runners
  - link redaction
  - provider error classification
  - webhook signatures (valid, tampered, stale, replayed)

  See `docs/verification.md`.
