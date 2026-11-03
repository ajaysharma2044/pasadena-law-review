import { and, eq } from "drizzle-orm";
import type { DB } from "../db/client";
import * as s from "../db/schema";

/**
 * Real content carried over from the static site. Idempotent and safe in production.
 * Nothing here is published: the article is an unpublished manuscript with open checks,
 * the issue is a hidden planning record, and the meeting is an unannounced draft.
 */

const SEED_MARKER = "_seed_content_v1";

export const ARTICLE_TITLE = "A Second Draft";

const ARTICLE_DECK = "A Student Proposal for a Restorative and Developmental Path in the Student Conduct Process";

const ARTICLE_BODY = `I am proposing that Pasadena City College add a Restorative Resolution option to its student conduct and academic-integrity process, so that first-time and lower-level cases can be resolved through reflection and support rather than punishment alone. The option would cost the college little and fits within students’ existing rights under California law.[^1] It can start as a one-year pilot, and serious cases would stay in the formal process.

## I. How First Offenses Are Handled Now

The discipline process at PCC is built to decide whether a student broke a rule and to assign a penalty. That is necessary for serious misconduct. For a first academic-integrity slip or a one-time conduct issue, though, a penalty alone teaches the student nothing and can push them out of school.

A conduct mark or a failed course can end a transfer plan or lead to a withdrawal. It can also convince a struggling student (often a first-generation or working student) that they don’t belong here.

PCC is not unusual in this. I compared the student discipline procedures of thirteen California community college districts,[^2] and almost none of them offers a restorative or developmental path; they are written to decide responsibility and assign sanctions. They also differ from one district to the next, so a student’s rights and options depend on which college the student happens to attend.[^3] And none of them mentions AI, which means first-time academic-integrity cases involving AI are being decided under rules that did not anticipate it.[^4]

## II. A Restorative Option for First Offenses

For first-time and lower-level conduct and academic-integrity cases, the college would offer a restorative path. The student would write a reflection on what happened, who was affected, what they now understand, and what they will do next, then meet with the appropriate faculty or staff member to discuss it and complete an agreed educational step. If the student does this in good faith, the case would close with an educational outcome instead of a disciplinary sanction on their record. The college could adopt the option by adding a clause like this to its existing conduct procedure:

> For a first or lower-level violation that does not involve violence, threats to safety, discrimination or harassment, or academic misconduct affecting the integrity of a degree, the student may be offered a Restorative Resolution. Under this option the student completes a structured written reflection and an educational meeting or activity determined by the conduct officer or faculty member. Upon good-faith completion, the matter is resolved developmentally and no formal disciplinary sanction is recorded. Restorative Resolution is offered at the college’s discretion, is voluntary for the student, and does not waive the student’s right to the formal process or to appeal.

The educational step could be a follow-up meeting, a short workshop on academic integrity or study skills, a required check-in with tutoring or counseling, or, where it makes sense, a restorative conference with the people affected. In a non-serious case, any of these could replace a suspension or come before one.

Whichever path a case takes, students should get plain-language notice of the accusation and every deadline, reasonable time to respond, access to the information being used, and the right to bring an advisor or support person.[^5] The college should also publish a free, plain-language guide to the process, so that a student without money or connections can still prepare a response.

The academic-integrity policy should also say how AI use will be handled, and a first AI-related case should lead to a conversation and a reset rather than an automatic failure.

The option uses staff and resources the college already has, and it is consistent with the student-rights protections in the Education Code and with Title 5’s provisions on student participation in governance.[^6] If it keeps students enrolled, the effect should show up in figures the college already tracks, such as retention and equity gaps.

## III. What the College Would Need to Do

I ask the college to:

1. pilot the Restorative Resolution option for one academic year, starting with academic-integrity cases;
2. form a working group that includes students to settle the policy language and the list of educational steps; and
3. track repeat incidents, retention, and student experience during the pilot, and report the results before deciding whether to keep the option.

[^1]: *See* :sc[Cal. Educ. Code] § 66300 (West 2026) (rules of student conduct); *id.* § 76030 (suspension and expulsion).
[^2]: Administrative Procedure 5520 (Student Discipline Procedures) of thirteen California community college districts, reviewed by the author in September 2026 (comparison on file with the Pasadena Law & Policy Review).
[^3]: Most of the procedures apply a preponderance-of-the-evidence standard. Citrus and Victor Valley use the lower “substantial evidence” standard, and Chabot-Las Positas and Mt. San Antonio state no standard at all. *See supra* note 2.
[^4]: None of the thirteen procedures uses the terms “artificial intelligence,” “generative AI,” or “ChatGPT.” *See supra* note 2.
[^5]: Most of the thirteen procedures bar representation by an attorney at the hearing but allow a non-attorney advisor or support person. *See supra* note 2.
[^6]: *See* :sc[Cal. Educ. Code] §§ 66300, 76030 (West 2026); :sc[Cal. Code Regs.] tit. 5, § 51023.7 (2026) (student participation in governance).
`;

export const ARTICLE_CHECKS = [
  "Author identity and written permission to publish",
  "Author’s note, including any disclosure (the original draft mentioned a prototype resource)",
  "Author’s personal account in Part I supplied, or the author confirms it is omitted",
  "Exact counts and named districts from the 13-district AP 5520 review (notes 2–5) checked against the source PDFs",
  "Notes 1 and 6 checked against the Education Code and Title 5",
  "PCC’s own AP 5520 and academic-integrity policy cited by number",
];

// Page text as first imported from the static site, under the publication's original name.
export const PAGES_V1: Record<string, string> = {
  about: `The Pasadena Law & Policy Review is a student journal at Pasadena City College. It publishes essays, policy proposals, and notes by PCC students on law and public policy, and its members meet in person to debate them.

Law reviews are usually edited by law students. This one is edited by community college students, and much of what it covers concerns the rules that govern PCC and the other California community colleges.`,
  independence: `Opinions in the Review belong to their authors, not to the editors, Pasadena City College, or the Pasadena Area Community College District.`,
  submissions: `The Review publishes writing by current Pasadena City College students on law and public policy. Faculty, staff, and alumni may write for the Forum.

## What we publish

**Essays.** An argument about a legal or policy question. 1,000–8,000 words.

**Proposals.** A specific change to a rule, policy, or procedure, with the language you want adopted. Put the change in the first paragraph. Any length.

**Notes.** A close reading of one statute, case, or campus policy and how it works in practice. 2,000–5,000 words.

**Forum pieces.** A reply to something we published or debated. Up to 1,500 words.

## How to submit

Create an account and confirm your email address, then start a submission from your dashboard. You can save a draft and come back to it, preview the piece in the journal’s type, and attach a Word or PDF copy for the editors. You’ll get an email receipt when you submit, and you can follow the piece’s status in your dashboard.

Write footnotes with numbered markers; the Note button in the editor adds one for you. We don’t need your student ID number.

## Citations

Cite sources in footnotes rather than a works-cited page. We follow *The Bluebook*. If you haven’t used it, cite as clearly as you can and the editors will fix the form during the cite-check.

## After you submit

1. Two editors read the piece, and each recommends accepting it, asking for revisions, or declining it.
2. An administrator makes the decision. If revisions are requested, the editors’ comments appear in your dashboard and you can resubmit.
3. Editors check every footnote against its source.
4. The piece is published online once the checks are done.`,
  meetings_intro: `The Review meets in person on the PCC campus. Each meeting debates one motion.

## How a meeting runs

1. The chair reads the motion and introduces the opening speakers.
2. Opening speeches: one for the motion and one against, up to five minutes each.
3. The floor opens. Speakers alternate sides and have up to two minutes each.
4. Each opener gets one minute to close.
5. The room votes, and the chair records the result.
6. An editor writes up the minutes, which appear on this page within a week.

## Your first meeting

Come a few minutes early and sit anywhere. You can speak from the floor or just listen; nobody gets called on.

## Proposing a motion

Send the editors one sentence that begins “Resolved, That,” with a line on why it deserves an hour. Motions about PCC’s own rules, and about the California law that governs community colleges, get priority.`,
};

export const PUBLICATION_NAME = "Pasadena City College Law Journal";

/** The original page text under the current name. */
const renamed = (text: string) =>
  text
    .replaceAll("The Pasadena Law & Policy Review", `The ${PUBLICATION_NAME}`)
    .replaceAll("The Review", "The Journal")
    .replaceAll("the Review", "the Journal");

const PAGES: Record<string, string> = Object.fromEntries(Object.entries(PAGES_V1).map(([k, v]) => [k, renamed(v)]));

/**
 * Pages still showing the untouched original text get the renamed text as a new published version.
 * Pages anyone has edited are left alone. Safe to run on every build.
 */
async function renameUntouchedPages(db: DB) {
  let renamedCount = 0;
  for (const [pageKey, original] of Object.entries(PAGES_V1)) {
    await db.transaction(async (tx) => {
      const [live] = await tx
        .select()
        .from(s.cmsPageVersions)
        .where(and(eq(s.cmsPageVersions.pageKey, pageKey), eq(s.cmsPageVersions.status, "published")))
        .for("update");
      if (!live || live.bodyMd !== original || PAGES[pageKey] === original) return;
      await tx.update(s.cmsPageVersions).set({ status: "superseded" }).where(eq(s.cmsPageVersions.id, live.id));
      await tx.insert(s.cmsPageVersions).values({ pageKey, bodyMd: PAGES[pageKey], status: "published", note: `Renamed to ${PUBLICATION_NAME}`, decidedAt: new Date() });
      renamedCount += 1;
    });
  }
  return renamedCount;
}

export async function seedContent(db: DB) {
  const [done] = await db.select().from(s.siteSettings).where(eq(s.siteSettings.key, SEED_MARKER));
  if (done) return { seeded: false, renamed: await renameUntouchedPages(db) };

  await db.transaction(async (tx) => {
    for (const [pageKey, bodyMd] of Object.entries(PAGES)) {
      await tx.insert(s.cmsPageVersions).values({
        pageKey,
        bodyMd,
        status: "published",
        note: "Carried over from the static site",
        decidedAt: new Date(),
      });
    }

    const [vol] = await tx.insert(s.volumes).values({ number: 1, label: "Volume I", yearLabel: "2026–27" }).returning();
    await tx.insert(s.issues).values({ volumeId: vol.id, number: 1, termLabel: "Fall 2026", visible: false, sortOrder: 1 });

    const [m] = await tx
      .insert(s.manuscripts)
      .values({
        authorId: null,
        attributionNote:
          "Migrated from the static site. The author is not confirmed in this system; publication needs the author’s permission and a public byline.",
        kind: "proposal",
        status: "submitted",
        title: ARTICLE_TITLE,
        deck: ARTICLE_DECK,
        bodyMd: ARTICLE_BODY,
        submittedAt: new Date(),
      })
      .returning();
    const [rev] = await tx
      .insert(s.manuscriptRevisions)
      .values({
        manuscriptId: m.id,
        seq: 1,
        source: "migration",
        kind: "proposal",
        title: ARTICLE_TITLE,
        deck: ARTICLE_DECK,
        abstract: "",
        bodyMd: ARTICLE_BODY,
        authorBio: "",
        disclosure: "",
        note: "Imported from site/articles/a-second-draft.html",
      })
      .returning();
    await tx.update(s.manuscripts).set({ currentRevisionId: rev.id }).where(eq(s.manuscripts.id, m.id));
    await tx.insert(s.publicationChecks).values(ARTICLE_CHECKS.map((label) => ({ manuscriptId: m.id, label })));

    await tx.insert(s.meetings).values({
      status: "draft",
      motion:
        "Resolved, That Pasadena City College should offer a Restorative Resolution option for first-time conduct and academic-integrity cases.",
      attendancePolicy: "Any PCC student",
    });

    await tx.insert(s.auditEvents).values({ action: "seed.content", targetType: "system", targetId: SEED_MARKER, metadata: {} });
    await tx.insert(s.siteSettings).values({ key: SEED_MARKER, value: { at: new Date().toISOString() } });
  });
  return { seeded: true, renamed: 0 };
}
