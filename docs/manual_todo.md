# Owner to-do list

These are the things only you (the owner) can do. They're in dependency order: each step needs the ones above it. Where there's a reasonable default, it's marked **Recommended**.

You never need to send anyone a password or API key. Secrets go straight into Netlify's or Resend's settings pages.

## 1. Review the code

1. **Read [pull request #1](https://github.com/ajaysharma2044/pasadena-law-review/pull/1)** (`feature/journal-app` → `main`). Its description summarizes the evidence; the automated checks (CI) run on it.
2. **Merge it yourself** when you're satisfied. Nothing was merged for you.

## 2. Hosting, database and storage (about 30 minutes)

3. **Neon** (database).
   - Create a free account at neon.com and a project in **AWS US East (Ohio)**.
   - Copy the **pooled** and the **direct** connection strings. Keep them private.
4. **Netlify** (website).
   - Add a new site from the GitHub repository `ajaysharma2044/pasadena-law-review`, production branch `main`.
   - Add the environment variables listed in `docs/deployment.md` step 3. Two need random values; generate each with the command shown there:
     - `BETTER_AUTH_SECRET`
     - `CRON_SECRET`
   - Attachments use Netlify Blobs automatically (`STORAGE_DRIVER=netlify-blobs`). There's no separate account.
5. **Deploy** and run the `/api/health` check in `docs/deployment.md`. Until email is set up (section 3), the site will refuse to run and its log will say exactly which settings are missing. That's intended.

## 3. Email (needs a domain)

6. **Choose a domain you control.** Sending email to members needs a domain verified with the email provider.
   - **Recommended:** a subdomain just for sending, like `mail.<your domain>`.
   - Buying a domain is a yearly cost and your decision. A PCC-hosted domain would need the college's approval.
7. **Resend:** create an account and add the sending domain. Copy each DNS record Resend shows into your DNS provider exactly, then add DMARC. Full steps: `docs/email-setup.md`.
8. **In Netlify,** set these variables, then redeploy:
   - `EMAIL_TRANSPORT=resend`
   - `RESEND_API_KEY`
   - `EMAIL_FROM` (on the verified domain)
   - `EMAIL_REPLY_TO` (the inbox editors read)
   - the webhook's `RESEND_WEBHOOK_SECRET`

## 4. First run

9. **Import the original content** once:
   ```bash
   DATABASE_URL="<direct string>" npm run db:seed:content
   ```
10. **Make yourself the first administrator.**
    1. Sign up on the live site and confirm your email. This is also your first real email test.
    2. Run:
       ```bash
       DATABASE_URL="<direct string>" npm run admin:bootstrap -- <your email>
       ```
11. **Run the rest of the smoke tests** in `docs/deployment.md`.
    - Use only addresses you own for test sign-ups.
    - In Admin → Email, check messages reach **Accepted** and then **Delivered**.
12. **Optional: a custom domain for the website.** Netlify → Domain management. Then update `APP_URL` and the Resend webhook URL.

## 5. People

13. **Editors.** Each editor signs up and applies (Account → Apply to be an editor), and you approve them in Admin → Applications. You can also change roles directly in Admin → Members.
    - Accepting a piece needs recommendations from **two editors who aren't the author**.
    - If you wrote "A Second Draft", you can't review it. Two other editors must.
14. **A second administrator** (**Recommended**), so the Review isn't locked out if you lose access. Promote a trusted editor in Admin → Members.

## 6. Facts only you know (Admin → Settings, Editor → Pages, Editor → Meetings)

15. **Name.**
    - Confirm the publication's name.
    - If the Review becomes a chartered PCC club, ask whether using "Pasadena" or PCC's name needs approval.
    - Don't add PCC's logo or seal without written permission.
16. **Contact details.**
    - The public contact address and the Instagram handle (or the official PCC club-directory link).
    - Leave each empty until it exists. The site hides empty fields.
17. **Masthead.** Enter the real editors and faculty advisor, then publish the masthead. It stays hidden until you do.
18. **Meetings.** Day, time, building and room, and openers. Announce the first meeting in Editor → Meetings. Until then, the site says no meeting has been announced.
19. **Dates.**
    - The submission deadline note for Number 1 (Settings).
    - Make Volume I, Number 1 visible in Admin → Issues once it has published pieces.
20. **Policies I wrote as placeholders.** Edit them in Editor → Pages to match what you actually do:
    - word limits
    - who can submit and attend
    - the 5-, 2- and 1-minute speaking limits
    - two editors per piece
    - minutes within a week
21. **A short signed "From the editors" note** for the front page (Editor → Pages → Front-page note), in your own words.
22. **A privacy note for members.** Say what the site stores, who can see it, and how to ask for deletion. See `docs/data_dictionary.md` for what's stored. I didn't write one because it's a commitment the editors (and possibly your faculty advisor) should make.

## 7. "A Second Draft"

23. **Close the six publication checks** on the manuscript page (Editor → Review queue), each with real evidence:
    - the author's identity and written permission
    - the author's note and disclosure
    - the personal account in Part I, written by the author
    - the exact 13-district counts and district names, checked against the source PDFs (the September research files no longer exist)
    - notes 1 and 6 checked against the Education Code and Title 5
    - PCC's own AP 5520 and academic-integrity policy cited by number
24. **Run it through the normal process:** two editors recommend, an administrator accepts, then publishes with the real byline.

## 8. Ongoing

25. **Backups.**
    - **Recommended:** a weekly database dump, plus one before big changes.
    - A monthly attachment backup (see `docs/operations.md`).
26. **Glance at Admin → Email and the Admin overview** weekly for failed messages and waiting applications.
