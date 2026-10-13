# Guide for editors and administrators

No HTML or Git needed. Everything happens on the site after you sign in.

## Accounts

- **Sign up** (top right) with your name, email and a password of at least 10 characters.
  - Open the link in the confirmation email, then sign in. The link works for one hour.
  - If it expires, the sign-in page can send a new one.
- **Forgot your password:** use "Forgot your password?" on the sign-in page. The link works once, for one hour, and signs you out everywhere.
- **Your public name and bio** (the byline on published work) are under Account → Public profile.
- **To become an editor:** Account → "Apply to be an editor". An administrator approves or declines, and you get an email either way.

## Writing and submitting (any member)

1. Dashboard → **Start a submission**, then pick Essay, Proposal, Note or Forum piece.
2. Fill in the title, an optional subtitle and abstract, and the text.
   - **Formatting buttons:**
     - Italic, Bold, Heading, Quotation, Link
     - **Small caps** for statute names, as in law reviews
     - **Note**, which adds a numbered footnote marker and a line for the note text at the end
   - Under the hood it's Markdown:
     - `*italic*`, `**bold**`
     - a line starting `## ` is a heading; a line starting `> ` is a quotation
     - `[^1]` marks a note, and a line `[^1]: Source.` holds its text
3. **Save draft** often. The page warns you if you try to leave with unsaved changes.
4. **Preview** shows the piece in the journal's real typography. "Preview below" in the toolbar shows it on the same page.
5. Optionally attach a Word (.docx) or PDF copy for the editors (up to 10 MB). Readers never see attachments.
6. Tick the three confirmations and **Submit**. You get a receipt by email.
7. If the editors ask for changes, their comments appear on the manuscript page. Revise, save, and **Resubmit**.
8. You can **withdraw** a piece any time before it's published.

## Reviewing (editors)

1. **Editor → Review queue** lists submitted pieces.
   - Filter by "Assigned to me", "No reviewer yet", kind or status.
   - Your own submissions never appear there; you can't review your own work.
2. Open a piece and press **Review this piece** to take it on, or an administrator can assign you.
3. **Read** the version under review. **Versions** lists every submission and editors' edit; **Compare** shows exactly what changed between any two.
4. **Comments to the author** are sent to the author.
5. **Internal notes** are for editors and administrators only. The author never sees them, and they're never emailed.
6. **Record a recommendation:** Accept, Ask for changes, or Decline, with your reasons. Reasons are for editors only.
   - Each editor recommends once per version.
   - **Two different editors** must recommend on the current version before an administrator can accept it.
7. **Edit the text** (copyediting, citation form) saves a new *editors' version* with a note on what you changed. It doesn't change the version under review or anything already published.

## Deciding and publishing (administrators)

On the same manuscript page:

1. **Decision:**
   - **Accept** (only after two recommendations)
   - **Request changes** (a note to the author is required)
   - **Decline**
   - **Reopen** a declined piece

   If someone else acted on the piece since you opened the page, you'll be asked to reload instead of overwriting their decision.
2. **Publication checks:** add anything that must be true before publishing (for example "Author's permission confirmed", "Citations checked"), then mark each done. Publishing is blocked while any check is open.
3. **Publish:**
   - choose which version readers get (usually the latest editors' version)
   - set the web address
   - set the public byline
   - set the issue and order, if it belongs in a numbered issue

   Readers then see a fixed copy of that version. Later edits don't change it until you publish again.
4. **Published versions** lists every published copy. "Make this live" restores an earlier one, and **Unpublish** removes the article from every public page, keeping its history.

## Pages, meetings, issues and settings

- **Editor → Pages:** propose a change to About, the independence statement, the submission guidelines, the Meetings page text, or a front-page note from the editors. Administrators publish or decline proposals, or publish directly. Nothing public changes until an administrator publishes.
- **Editor → Meetings:**
  - Editors prepare draft meetings and minutes.
  - An administrator **announces** a meeting: date and time (in its time zone, America/Los_Angeles for PCC), building and room, motion, openers, who can come.
  - After the meeting, an administrator marks it **held** and ticks "Publish the minutes".
  - Until a meeting is announced, the public site says "No meeting has been announced yet."
- **Admin → Issues:** create volumes and numbered issues. An issue appears on the Journal page only when **Visible** is ticked.
- **Admin → Settings:**
  - publication name and lines around it
  - public contact email and Instagram (leave empty until they exist)
  - front-page lead
  - whether submissions are open, and the deadline note. When they're closed, members can't start or submit new pieces, but revisions the editors asked for still come in.
  - whether new accounts need approval
  - the masthead (stays hidden until you publish a list of real, appointed people)
- **Admin → Members:**
  - search, change roles, suspend (immediately signs the person out everywhere), reactivate
  - the site won't let you remove the last active administrator
- **Admin → Email:** delivery status of every message, and a Retry button for failed ones.
- **Admin → Audit log:** a record of administrative and editorial actions.

## "A Second Draft"

The original article is in the queue as an imported piece with no confirmed author, plus six open publication checks:
- author permission
- author's note and disclosure
- personal account
- the 13-district counts
- notes 1 and 6
- PCC's own policy citation

It stays unpublished until those are resolved, it goes through the same two-editor review, and an administrator publishes it with a real byline.
