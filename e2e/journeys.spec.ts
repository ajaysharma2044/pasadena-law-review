import { expect, test } from "@playwright/test";
import { ORIGIN, mailboxLink, signIn, signOut, signUpAndVerify } from "./helpers";

const AUTHOR = { name: "Avery Author", email: "avery@author.test" };
const TITLE = "Parking Appeals at PCC: A Proposal";
const SLUG = "parking-appeals-at-pcc-a-proposal";
let authorPassword = "";
let manuscriptUrl = "";

test.describe.serial("worked traces", () => {
  test("Trace 1: an author signs up, verifies, submits and gets a receipt", async ({ page }) => {
    authorPassword = await signUpAndVerify(page, AUTHOR.name, AUTHOR.email);
    await signIn(page, AUTHOR.email, authorPassword);
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Start a submission" }).click();
    await page.getByLabel(/Proposal\./).check();
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByText("Draft saved.")).toBeVisible();
    manuscriptUrl = new URL(page.url()).pathname;

    await page.getByLabel("Title", { exact: true }).fill(TITLE);
    await page.getByLabel("Subtitle (optional)").fill("Why first-time citations deserve a second look");
    await page
      .getByLabel("Text, with notes")
      .fill("PCC should let students appeal a first parking citation online.[^1]\n\n## I. The current rule\n\nAppeals happen in person only.\n\n[^1]: *See* :sc[Cal. Educ. Code] § 76360.");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved.")).toBeVisible();

    await page.getByLabel(/I wrote this piece/).check();
    await page.getByLabel(/cited my sources/).check();
    await page.getByLabel(/disclosed anything/).check();
    await page.getByRole("button", { name: "Submit to the editors" }).click();
    await expect(page.getByText("Submitted. A receipt is on its way")).toBeVisible();
    await expect(page.getByText("Submitted", { exact: true })).toBeVisible();

    const receipt = await mailboxLink(page, AUTHOR.email, manuscriptUrl);
    expect(receipt).toContain(manuscriptUrl);
    await expect(page.getByRole("heading", { name: `Received: “${TITLE}”` })).toBeVisible();
    await expect(page.locator("section", { hasText: "To editor1@demo.test" }).first()).toContainText("New submission");
  });

  test("Trace 2: editors ask for changes, the author resubmits, and only the approved version is published", async ({ page }) => {
    const editorUrl = manuscriptUrl.replace("/manuscripts/", "/editor/manuscripts/");

    // first editor takes the review and comments to the author
    await signIn(page, "editor1@demo.test");
    await page.goto(editorUrl);
    await page.getByRole("button", { name: "Review this piece" }).click();
    await expect(page.getByText("You’re now reviewing this manuscript.")).toBeVisible();
    await page.getByLabel("Comment to the author").fill("Please cite the current appeal procedure.");
    await page.getByRole("button", { name: "Send to the author" }).click();
    await page.getByLabel("Internal note", { exact: true }).fill("INTERNAL ONLY: check whether 76360 is the right section.");
    await page.getByRole("button", { name: "Add internal note" }).click();
    await signOut(page);

    // second editor takes the review
    await signIn(page, "editor2@demo.test");
    await page.goto(editorUrl);
    await page.getByRole("button", { name: "Review this piece" }).click();
    await signOut(page);

    // administrator asks for changes
    await signIn(page, "admin@demo.test");
    await page.goto(editorUrl);
    await page.getByLabel("Note to the author").fill("Please address the editors’ comment and resubmit.");
    await page.getByRole("button", { name: "Request changes" }).click();
    await expect(page.getByText("The decision was recorded")).toBeVisible();
    await signOut(page);

    // the author sees the comment (not the internal note), revises and resubmits
    await signIn(page, AUTHOR.email, authorPassword);
    await page.goto(manuscriptUrl);
    await expect(page.getByText("Please cite the current appeal procedure.")).toBeVisible();
    await expect(page.getByText("INTERNAL ONLY")).toHaveCount(0);
    const body = page.getByLabel("Text, with notes");
    await body.fill(`${await body.inputValue()}\n\nThe appeal form is in the parking office.[^2]\n\n[^2]: PCC Parking Services, Citation Appeals (2026).`);
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.getByLabel(/I wrote this piece/).check();
    await page.getByLabel(/cited my sources/).check();
    await page.getByLabel(/disclosed anything/).check();
    await page.getByRole("button", { name: "Resubmit" }).click();
    await expect(page.getByText("Resubmitted.")).toBeVisible();
    await signOut(page);

    // both editors recommend acceptance of the new version
    for (const editor of ["editor1@demo.test", "editor2@demo.test"]) {
      await signIn(page, editor);
      await page.goto(editorUrl);
      await page.getByLabel("Accept").check();
      await page.getByRole("button", { name: "Record recommendation" }).click();
      await expect(page.getByText("Your recommendation was recorded.")).toBeVisible();
      await signOut(page);
    }

    // administrator accepts and publishes the approved version
    await signIn(page, "admin@demo.test");
    await page.goto(editorUrl);
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(page.getByText("The decision was recorded")).toBeVisible();
    await page.getByLabel("Public byline").fill("Avery Author");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.getByText("Published. The article is live.")).toBeVisible();
    await signOut(page);

    await page.goto(`/articles/${SLUG}`);
    await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
    await expect(page.getByText("The appeal form is in the parking office.")).toBeVisible();
    await expect(page.getByText("INTERNAL ONLY")).toHaveCount(0);
    const publishedText = await page.locator(".body").innerText();

    // an editor's later edit doesn't change what readers see
    await signIn(page, "editor1@demo.test");
    await page.goto(editorUrl);
    const edit = page.getByLabel("Text", { exact: true });
    await edit.fill(`${await edit.inputValue()}\n\nUNPUBLISHED EDITORIAL CHANGE.`);
    await page.getByLabel("What you changed").fill("Trial edit after publication");
    await page.getByRole("button", { name: "Save editors’ version" }).click();
    await expect(page.getByText("Your edit was saved as a new editorial revision.")).toBeVisible();
    await signOut(page);
    await page.goto(`/articles/${SLUG}`);
    expect(await page.locator(".body").innerText()).toBe(publishedText);
    await expect(page.getByText("UNPUBLISHED EDITORIAL CHANGE")).toHaveCount(0);

    // and it now appears on the Forum-free indexes as a live piece
    await page.goto("/");
    await expect(page.getByRole("link", { name: TITLE })).toBeVisible();
  });

  test("Recognition: admin award/revoke, member privacy, and public bylines", async ({ page }) => {
    test.setTimeout(180_000);
    const badges = ["Published Author", "Senior Contributor", "Editorial Board", "Featured Scholar", "Founding Contributor"];
    await signIn(page, "admin@demo.test");
    await page.goto("/admin/badges");
    await page.getByLabel("Search registered users").fill(AUTHOR.email);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const memberOption = page.getByLabel("Member").locator("option").filter({ hasText: AUTHOR.email });
    const userId = await memberOption.getAttribute("value");
    expect(userId).toBeTruthy();
    for (const badge of badges) {
      await page.getByLabel("Member", { exact: true }).selectOption(userId!);
      await page.getByLabel("Badge", { exact: true }).selectOption({ label: badge });
      await page.getByLabel("Evidence / rationale").fill("Synthetic regression account; editorial appointment documented for test.");
      if (badge === "Editorial Board") await page.getByRole("checkbox", { name: /For an Editorial Board/ }).check();
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("Recognition was updated.");
    }
    await page.getByLabel("Member", { exact: true }).selectOption(userId!);
    await page.getByLabel("Badge", { exact: true }).selectOption({ label: "Published Author" });
    await page.getByLabel("Evidence / rationale").fill("Duplicate request");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("No change");
    await signOut(page);
    await page.goto(`/articles/${SLUG}`);
    await expect(page.locator(".byline")).not.toContainText("Published Author");

    await signIn(page, AUTHOR.email, authorPassword);
    await page.goto("/admin/badges");
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
    const denied = await page.request.post("/api/admin/badges", { headers: { origin: "http://localhost:3300" }, data: { userId, badgeKey: "published_author", action: "award", reason: "forged" } });
    expect(denied.status()).toBe(403);
    await page.goto("/account");
    for (const badge of badges) await expect(page.getByRole("listitem", { exact: true }).filter({ hasText: badge })).toBeVisible();
    const consent = page.getByRole("checkbox", { name: /Display recognition publicly/ });
    await expect(consent).not.toBeChecked();
    await consent.check();
    await page.getByRole("button", { name: "Save recognition privacy" }).click();
    await page.goto(`/articles/${SLUG}`);
    for (const badge of badges) await expect(page.locator(".byline")).toContainText(badge);
    await page.goto("/account");
    await page.getByRole("checkbox", { name: /Display recognition publicly/ }).uncheck();
    await page.getByRole("button", { name: "Save recognition privacy" }).click();
    await signOut(page);
    await page.goto(`/articles/${SLUG}`);
    await expect(page.locator(".byline")).not.toContainText("Published Author");

    await signIn(page, "admin@demo.test");
    for (const badge of badges) {
      await page.goto(`/admin/badges?q=${encodeURIComponent(AUTHOR.email)}`);
      await page.getByLabel("Member", { exact: true }).selectOption(userId!);
      await page.getByLabel("Badge", { exact: true }).selectOption({ label: badge });
      await page.getByLabel("Action", { exact: true }).selectOption("revoke");
      await page.getByLabel("Evidence / rationale").fill("Synthetic regression cleanup");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("Recognition was updated.");
    }
    await page.goto("/admin/audit");
    await expect(page.getByText("badge.award", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("badge.revoke", { exact: true }).first()).toBeVisible();
    await signOut(page);
  });

  test("Trace 3: a declined applicant and a revoked editor are refused, including direct requests", async ({ page }) => {
    const applicant = { name: "Riley Applicant", email: "riley@applicant.test" };
    const pw = await signUpAndVerify(page, applicant.name, applicant.email);
    await signIn(page, applicant.email, pw);
    await page.goto("/account/apply");
    await page.getByLabel("Why do you want to edit for the Journal?").fill("I edited my high school paper.");
    await page.getByRole("button", { name: "Send application" }).click();
    await expect(page.getByText("Your application was sent.")).toBeVisible();
    await signOut(page);

    await signIn(page, "admin@demo.test");
    await page.goto("/admin/applications");
    const appSection = page.locator("section", { hasText: applicant.name });
    await appSection.getByLabel("Note to the applicant (optional)").fill("Please come to a few meetings first.");
    await appSection.getByRole("button", { name: "Decline" }).click();
    await expect(page.getByText("The application decision was recorded")).toBeVisible();

    await page.goto("/admin/members?q=editor2");
    await page.getByLabel(/Role for Demo Editor Two/).selectOption("member");
    await page.getByRole("button", { name: "Set role" }).click();
    await expect(page.getByText("The role was changed.")).toBeVisible();
    await signOut(page);

    // the revoked editor loses the editor pages immediately
    await signIn(page, "editor2@demo.test");
    await page.goto("/editor");
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
    await signOut(page);

    // the declined applicant is still a member and is refused by privileged endpoints
    await signIn(page, applicant.email, pw);
    await page.goto("/account");
    await expect(page.getByText("Author (member)")).toBeVisible();
    await expect(page.getByText("Note from the editors: Please come to a few meetings first.")).toBeVisible();
    const headers = { Origin: ORIGIN, "Content-Type": "application/json" };
    const promote = await page.request.post("/api/admin/members/any-user/role", { headers, data: { role: "admin" } });
    expect(promote.status()).toBe(403);
    const publish = await page.request.post("/api/admin/manuscripts/00000000-0000-0000-0000-000000000000/publish", { headers, data: { revisionId: "x", slug: "x", byline: "x" } });
    expect(publish.status()).toBe(403);
    const claim = await page.request.post("/api/editor/manuscripts/00000000-0000-0000-0000-000000000000/claim", { headers, data: {} });
    expect(claim.status()).toBe(403);
  });
});
