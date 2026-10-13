# Spec: website for The Pasadena Law & Policy Review

"The Pasadena Law & Policy Review" is a working name. Anything in [square brackets] is a placeholder for the editors to fill in. This file is self-contained: paste all of it into a site builder, or hand it to a developer.

Revised Sept. 30, 2026, after two blind "human or AI?" reviews. §13 lists what they caught.

---

## 1. The brief

Build the website for a new student-run law and policy journal at Pasadena City College (PCC). It is half journal, half society:

- It **publishes student writing** the way the Yale Law Journal does: volumes and numbers, footnotes, a Forum for short replies, submission guidelines.
- It **holds in-person meetings** that debate one motion at a time, the way the Cornell Political Union does.

The site should look like a working student publication, close in spirit to The Cornell Daily Sun. **Nothing about it may look AI-generated:** not the design, not the writing, not the source code.

## 2. Readers and the site's three jobs

Readers:
- PCC students deciding whether to write, attend or read.
- PCC faculty and staff.
- People outside PCC who see the journal on a student's résumé or transfer application and check whether it is real.

The site's jobs, in priority order:
1. Present the published writing so it reads as a serious journal.
2. Get students to a meeting.
3. Bring in submissions.

## 3. References

| Site | Take | Leave |
|---|---|---|
| yalelawjournal.org | Kickers naming the piece type. Journal vs. Forum split. Submissions as a top-level page. Footnotes and citation form. | Navy palette, crest, carousel, the volume strip (too much for a new journal) |
| cornellsun.com | Red section bar across the top. Centered nameplate with a small line above it. Red rule under the header. Lead story on the left with a rail on the right, split by a thin red vertical rule. | Blackletter nameplate (theirs), live dateline (they're daily, we're not), ads, popups, social icons |
| cornellpoliticalunion.org | Meetings as a first-class page. A plain statement of who they are. Photos of their own people (later). | Seal pastiche, faded-column background, "Learn more" buttons |

## 4. Identity

- **Name:** [The Pasadena Law & Policy Review]
- **Citation form:** [Pasadena L. & Pol'y Rev.] (Bluebook abbreviations: Law → L., Policy → Pol'y, Review → Rev.)
- **Nameplate:** type only.
  - Old Standard TT Bold, with a roman (non-bold) italic ampersand.
  - The small line above it, in display italic: "A student journal at Pasadena City College".
  - The line under it: "Volume I, Fall 2026".
- **Favicon:** the same italic ampersand, white on red, rendered from the actual font.
- **Never** use PCC's logo, seal or any official mark without written permission from the college.

## 5. Pages

Seven pages, all static HTML. The nav has four items: Journal, Meetings, Submissions, About.

- **Front page (`index.html`):** two columns at 2:1, separated by a 1px red vertical rule.
  - **Left, the lead piece**, left-aligned:
    - kicker with the piece type
    - headline in the display serif (56px)
    - deck in display italic, Title Case
    - byline, then "Volume I, Number 1 (Fall 2026)"
    - the piece's first two paragraphs
    - one "Continue reading" link
  - **Right, the rail:** two plain notes, each under a 2px black rule with a serif heading.
    - "Next meeting": When / Where, the motion in "*Resolved*, That …" form, and an inline link to Meetings.
    - "Submissions": one sentence, with an inline link to the guidelines.
- **Article (`articles/a-second-draft.html`):** law-review setting.
  - Centered header: kicker, title, deck, byline with an asterisk author note.
  - Body: a 680px column of Charis SIL at 19px.
    - Indent the first line of each paragraph by 1.6em, with no space between paragraphs and no indent after a heading, list or block quote.
    - At most three Part headings for a piece under 1,000 words.
    - The proposed policy language goes in an indented block quote: no border, no tint.
  - Notes section:
    - Footnote numbers link down and back, and the targeted note is highlighted.
    - Citation forms must be correct Bluebook: no `supra` for statutes, no `et seq.`, publisher and year on code cites, and "(on file with …)" for unpublished material.
    - A "Cite as" line, with the journal name in small caps.
- **Journal (`issues.html`), single centered column:**
  - Number 1's table of contents: kicker, title link, byline.
  - Number 2's reading date.
  - The Forum (`#forum`): one line on what it publishes, plus an honest empty state.
- **Meetings (`meetings.html`):** a main column plus one sidebar note.
  - Next-meeting facts: When, Where, Motion, Openers, Open to.
  - How a meeting runs, as an ordered list (it's a real sequence).
  - Proposing a motion.
  - Minutes (empty state).
  - Sidebar: "Your first meeting".
- **Submissions (`submissions.html`), single centered column:**
  - The address and deadline in the page intro.
  - What we publish (Essays, Proposals, Notes, Forum pieces, with lengths).
  - How to submit.
  - Citations.
  - After you submit (an ordered list).
- **About (`about.html`), single centered column:** what it is, why it exists at a community college, independence, contact. No mission/vision/values.
- **Masthead (`masthead.html`):** a centered list of roles. **Don't link it until real names are in.**

## 6. Shared header and footer

- **Header:**
  1. Skip link.
  2. Red section bar: uppercase Libre Franklin 600 at 13px. It wraps on phones (no hamburger, no sideways scrolling).
  3. Centered nameplate block, with a 2px red rule under it.
- **Footer:**
  - a 3px black rule
  - the name in the display serif
  - "A student journal at Pasadena City College. Opinions are the authors' own. Write to [email]."
  - page links
  - © 2026
- **Leave out:** dateline JavaScript, header buttons.

## 7. Design tokens

### 7.1 Color

| Token | Hex | Use |
|---|---|---|
| `--bg` | #FFFFFF | Page |
| `--black` | #141414 | Text, rules, sidebar headings, footnote numbers |
| `--gray` | #5F5F5F | Meta, placeholders (6.4:1) |
| `--line` | #D9D9D9 | Hairlines |
| `--tint` | #F3F3F3 | Cite-as box, targeted footnote |
| `--red` | #8B1A12 | Section bar, nameplate rule, column rule, kickers. Nothing else. |
| `--red-deep` | #6A120C | Current page and hover in the bar |

### 7.2 Type

- **Display: Old Standard TT** (400, 400 italic, 700). A late-19th-century "Modern" face of the kind used in old law reports.
- **Text: Charis SIL**, the Google Fonts build of Charter. *Typography for Lawyers* recommends Charter.
- **Labels: Libre Franklin** (400, 600, 700). The standard American newspaper label face.
- **Never:** Inter, Roboto, Poppins, Montserrat, Playfair Display, Fraunces, Space Grotesk, DM Sans/Serif, Instrument Serif, Cormorant.
- **Scale:** 13 / 14 / 15 / 17 / 19 / 23px, plus fluid headline sizes.
- **Capitals:** only three uppercase styles (section bar, kicker, small caps in citations). Every other label is sentence case.

### 7.3 Layout

- 1180px wrap for two-column pages; 760px centered column for single-column pages.
- Gutters of 24px, or 18px under 760px wide. Breakpoints at 900px and 760px.
- No rounded corners, no shadows, no animation, no images until the editors supply real photos.

### 7.4 Signature

The italic ampersand in the nameplate, repeated as the favicon. Nothing else is decorative.

## 8. Writing rules

- **Plain and specific:** sentence-case headings, active verbs, inline links instead of stand-alone call-to-action links.
- **Banned words:** delve, elevate, empower, unlock, seamless, robust, vibrant, foster, journey, landscape (figurative), tapestry, testament, navigate (figurative), cutting-edge, game-changer, transformative, holistic, passionate, leverage, synergy, "in today's world", "at the intersection of".
- **Banned patterns:**
  - "not X, but Y" and "Whether you're…"
  - question headings
  - exclamation points
  - lists of three used for rhythm
  - one-line maxims standing as their own paragraph
  - colon payoffs ("close to home: …")
  - label-then-sentence lists inside prose
  - a personal stake bolted onto the last line
- **Say each thing once,** where it belongs.
- **Write only what exists.**
  - No "usually" or "online only" before there is a usual or a print edition.
  - Plans go in the future tense.
  - Empty sections say so and tell the reader what to do.
- **Never invent people, quotes, dates, statistics, citations or past events.**
  - Unknown facts go in gray [brackets].
  - Prefer exact counts ("9 of 13") to "most". Use them as soon as the data is in hand.
- **Typography:** curly quotes; en dashes for ranges; no em dashes in site copy.

## 9. AI-tell checklist (all must pass; `audit/checks.txt` automates 1–32)

**Visual**
1. No gradients.
2. No blur or glass effects.
3. No box shadows.
4. No rounded cards.
5. No emoji.
6. No icon sets.
7. No hero with two buttons.
8. No stat counters.
9. No testimonials.
10. No stock or AI-generated images.
11. No motion.
12. No dark-mode toggle.
13. No banned fonts.
14. White page.
15. No decorative 01/02/03.
16. Kickers only on listings.
17. No thick left-border callouts.
18. No arrow glyphs.

**Writing**

19. No banned words.
20. No banned constructions.
21. No em dashes.
22. No exclamations or question headings.
23. No mission/vision/values; no "Learn more" or "Get started".
24. No lorem ipsum.

**Code and structure**

25. No section-label HTML comments, generator meta or utility-class soup.
26. All internal links and anchors resolve.
27. WCAG AA contrast.
28. No live dateline or decorative JavaScript.
29. No drawn objects standing in for photos.
30. At most three uppercase styles.
31. At most five letter-spacing values.
32. Type scale of at most eight sizes.

## 10. Technical requirements

- **Stack:** plain HTML and one CSS file. No JavaScript, no framework, no build step.
- **Links:** relative, so it works from disk or any static host.
- **Head:** Google Fonts with `display=swap`; `favicon.ico` and `apple-touch-icon.png`.
- **Accessibility:** semantic landmarks, one `h1` per page, skip link, labelled nav with `aria-current`, visible focus rings, no horizontal scroll at 320–1440px.

## 11. Content the editors still need to supply

- Final name.
- Editors and faculty advisor (then link the Masthead).
- Club status.
- Contact and submissions email.
- Meeting day, time and room; opening speakers.
- Deadline for Number 1; reading dates for Number 2.
- For "A Second Draft":
  - the author's name and personal account
  - exact counts from the 13-district table, ideally with the table published
  - a citation for any research claim
- Meeting photos, and a club Instagram or official club-directory link.

## 12. Done when

- All seven pages load with zero console errors at 375px and 1440px wide, with no horizontal scroll.
- Every item in §9 passes.
- No lorem ipsum, invented people, quotes or citations.
- A reviewer who has not seen this spec looks at the screenshots, is asked "human-made or AI-made?", and can name no specific AI tell that survives revision.

## 13. What the blind reviews caught (so the next builder doesn't repeat it)

- **Machinery before content:** a volume strip, a CSS-drawn issue cover, page numbers and a masthead made of placeholders, all for one unfinished piece.
- **Costume:** a live date on a twice-a-year journal; header buttons that vanished on phones.
- **Landing-page skeleton:** a centered hero, then bands that each end in the same red link.
- **Repetition:** reassurance repeated three times, the Forum explained five times, contradictory dates.
- **Every label in tiny spaced-out caps;** nine letter-spacing values; sixteen font sizes.
- **Chatbot persuasive prose:** lists of three, "built to X… not built to Y", "Why This Matters" and "Easy Yes" headings, slogan endings.
- **The article:** a pitch for the author's own tool with no disclosure; citations that look right but break Bluebook rules.
- **Sidebar boxes** that repeat the main column.
- **Code house style:** print-themed variable names, `·` in every title, an `aria-labelledby` id on every section, a self-explaining JS comment.
