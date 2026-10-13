# The Pasadena Law & Policy Review: website

| Folder | What's in it |
|---|---|
| `SPEC.md` | The full spec prompt. Paste it into any site builder, or hand it to a developer. §13 lists the AI tells that blind reviewers caught, so nobody repeats them. |
| `site/` | The finished website: 7 pages, plain HTML/CSS, no JavaScript, no build step. |
| `research/` | Notes on the three reference sites, plus their screenshots. |
| `audit/` | Verification: `report.md` (pass/fail with evidence), `checks.txt` (32 automated checks), `screens/` (full-page screenshots), `review/` (the screenshots the blind reviewers saw). |

## Look at it

Open `site/index.html` in a browser. Everything works from disk; the fonts load from Google Fonts, so you need internet.

## Fill in the placeholders

Anything gray in [square brackets] is something only you know. Search `site/` for `class="tbd"` to find them all (37).

- **Names:**
  - author of "A Second Draft"
  - editors and faculty advisor (`masthead.html`)
  - opening speakers
- **Logistics:**
  - meeting day, time and room (`index.html`, `meetings.html`)
  - contact and submissions email
  - deadline for Number 1 and reading dates for Number 2
- **Masthead:** `masthead.html` is built but not linked anywhere yet, because a page of [Name] lines looks fake. Once the names are in, add a Masthead link to the footer and the About page.

## The biggest things you can still do

Three blind reviewers still read the site as AI-made (8/10, then 7/10, then 7/10). Everything below needs your real information, so I couldn't do it for you:

1. **Write a short signed "From the editors" note** for the front page: who started the Review, when, and why. Two or three sentences, in your own words.
2. **Make the article yours.** "A Second Draft" was copyedited to strip chatbot patterns, but the reviewers could still tell. Read it aloud and rewrite anything you wouldn't say. Then add your personal account: three concrete sentences in Part I about your own case. I deliberately didn't write that part.
3. **Use real numbers.** Replace "almost none" and "most" with exact counts from your 13-district table ("11 of 13"). Name the districts, and if you can, publish the table as its own page. Your September research files were in a temporary folder that is gone, so you'll need to redo or recover the counts.
4. **Show it's real.**
   - one photo from your first meeting (top of `meetings.html`)
   - the club's Instagram handle (there's a placeholder in the footer) or its official PCC club-directory link
   - a named founding editor
5. **Cite PCC's own procedure.** Part I describes "the discipline process at PCC." Cite PCC's AP 5520 by number. If PCC's academic-integrity policy really says nothing about AI, say so with a citation (I removed the uncited version of that line).

## Changes I made to your proposal text (so nothing surprises you)

- I removed:
  - the memo header (To/Re/Date)
  - the sign-off
  - the claim that "the research … is consistent" (it had no source)
  - "often punitively" (no source)
  - the line about a working prototype (in a journal it reads as a pitch for your own tool, so disclose it in the author's note if you add it back)
- I restructured it into an introduction and three parts, cut repeated points, and fixed the Bluebook form of every citation.
- Every remaining claim is yours.
- Footnotes 2–5 come from your September 2026 review of 13 districts' AP 5520 procedures. Check them against the source PDFs before publishing.

## Policies I wrote as reasonable defaults

Edit these to match what you actually do:

- word limits
- who can submit and who can attend
- 5-, 2- and 1-minute speaking limits
- two editors read each piece
- minutes within a week

## Change the name

Find-and-replace across `site/`:

- `The Pasadena Law &amp; Policy Review` (in the HTML source)
- `Pasadena L. &amp; Pol’y Rev.` (citation form)

## Publish it (free)

- **Netlify Drop:** drag the `site` folder onto app.netlify.com/drop.
- **GitHub Pages:** put the contents of `site/` in a repository, then turn on Pages in the repository settings.

If the Review becomes a chartered PCC club, ask whether using "Pasadena" in the name needs approval. Don't add PCC's logo or seal without written permission.
