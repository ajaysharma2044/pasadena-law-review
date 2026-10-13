# Verification report

Sept. 30, 2026. Items 1–3 were re-run on the final build after the last edit. Item 4 is the latest blind review (round 3); a few polish fixes came after it (listed below) and were not re-reviewed.

## "Done when" results

| # | Done when (from SPEC.md §12) | Result | Evidence |
|---|---|---|---|
| 1 | All seven pages load with zero console errors at 375px and 1440px, with no horizontal scroll | **PASS** | In-browser audit, 7 pages × 2 widths = 14 runs, 0 problems: no horizontal overflow, no element past the edge, one `h1` per page, no heading skips, no duplicate ids, no empty links, no broken anchors, all three web fonts loaded. Console: no errors. Server log: no 404s since the favicon was added at 21:44. |
| 2 | Every item on the AI-tell checklist passes | **PASS** | `audit/checks.txt`: 32/32. The CSS has no rules for classes that no page uses (verified: 0). |
| 3 | No lorem ipsum, invented people, quotes or citations | **PASS** | Every unknown is a gray bracketed placeholder (37 on the site). The footnotes cite only the Education Code, Title 5 and your 13-district AP 5520 review. Nothing was invented. |
| 4 | A blind reviewer can name no AI tell that survives revision | **FAIL** | Three fresh reviewers, none of whom saw the spec or the checks, still called it AI-made: **8/10 → 7/10 → 7/10**. Every round still named tells. The ones left now mostly need your real-world content (see below) or come from the newspaper/journal look the brief asked for. |

## Blind reviews

| Round | Verdict | Main tells named | What I changed |
|---|---|---|---|
| 1 | AI-made, 8/10 | Chatbot rhythm in the article; four Bluebook errors; full journal machinery around one unfinished piece; live date and header buttons; CSS-drawn cover; copy repeated across pages; tiny caps everywhere; sixteen font sizes | Rebuilt the CSS on a small type scale. Removed the cover, the volume strip, the dateline JS and the header buttons. Made the home page a lead article plus a sidebar of notes. Said each thing once. Fixed the citations. Renamed variables. Removed the `aria-labelledby` ids. |
| 2 | AI-made, 7/10 | Article over-structured (12 headings) and repetitive; label-list rhythm; a bolted-on personal line; a prototype pitch; "most" instead of counts; copy describing habits that don't exist yet; gray widget boxes; no photos; subtitle case; favicon font | Rewrote the article to 725 words under 3 Parts. Cut the maxim, the cover-letter line and the prototype pitch. Removed "usually" and "online only". Unlinked the placeholder masthead. Made the boxes plain notes. Cut back the red. Centered single-column pages. Rendered the favicon from the nameplate's ampersand. |
| 3 | AI-made, 7/10 | Stock "editorial" front page; no people, founding note or socials; problem/solution/ask outline with uncited claims; one voice for author and editors; explanatory CSS comments; source "too perfect"; six rule styles and an empty Meetings sidebar; unused CSS; first-paragraph indent and fake small caps; inconsistent capitalization; tagline and volume repeated | Polish after round 3, **not re-reviewed**: bare CSS comments; dead CSS removed; first paragraph unindented (verified 0px); true small caps; three rule styles; Meetings sidebar folded into the column; doubled phone rule removed; "Restorative Resolution" capitalized everywhere; tagline and volume each shown once; front-page excerpt cut to one paragraph with the label moved into the byline; repeated point and uncited PCC claims removed from the article; specific Part titles; a join line on About; an Instagram placeholder. |

## What's left, and why I didn't do it

**Needs you:**
- a short signed "From the editors" founding note (who, when, why)
- real names, and linking the Masthead once they're in
- photos of the first meeting
- the Instagram handle
- your own voice in the article, including your personal account
- exact counts and named districts from your 13-district table
- PCC's own AP 5520 / academic-integrity policy cited by number
- a second writer for the editors' pages, so the site isn't one voice

**My call not to change:**
- Moving the content to Markdown with an Eleventy or Jekyll build would add a build step. The spec chose none.
- Switching to straight quotes would make the typography worse.
- Your article's subtitle stays as you wrote it.
- The newspaper/journal look is what you asked for, and one reviewer counted the look itself as a tell.

## How it was verified

- **Automated checks** (`audit/checks.txt`), 32 in all:
  - visual: gradients, shadows, radius, emoji, icons, motion, fonts, caps styles, letter-spacing, type scale
  - writing: banned words and constructions, em dashes, exclamations, question headings, lorem
  - code: comments, generator meta, JS, links and anchors
  - WCAG contrast computed from the actual color tokens: lowest pair is gray on tint at 5.75:1; AA needs 4.5
- **Browser audit:** the in-app browser loaded each page in 1440px and 375px frames and inspected the DOM.
- **Screenshots:**
  - `audit/screens/`: the final build. Headless Chrome with a clean profile. Phone captures use a true 375px iframe, because headless Chrome on macOS won't make a window narrower than about 500px.
  - `audit/review/`: exactly what the round-3 reviewer saw, before the polish pass.
- **Not run:** Lighthouse. It isn't installed, and I didn't install packages. The contrast computation and DOM audit cover its accessibility checks for this site, except screen-reader testing.

## What can and can't be claimed

- **Can claim:** passes 32 automated AI-tell, link and contrast checks; renders cleanly on phones and desktop; contains no invented content; three blind reviewers moved from 8/10 to 7/10 "AI-made".
- **Can't claim:** that it is "undetectable as AI", that it now passes a blind review, or that PCC endorses it.
