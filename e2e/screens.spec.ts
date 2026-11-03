import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { signIn } from "./helpers";

const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });
const findings: Record<string, unknown[]> = {};

async function check(page: Page, name: string, widths: number[]) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const culprits = overflow > 0
      ? await page.evaluate(() =>
          [...document.querySelectorAll("body *")]
            .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
            .filter((el) => !el.parentElement?.closest(".table-wrap"))
            .slice(0, 8)
            .map((el) => `${el.tagName.toLowerCase()}.${el.className}[w=${Math.round(el.getBoundingClientRect().width)}]`),
        )
      : [];
    expect(overflow, `${name} scrolls sideways at ${width}px: ${culprits.join(", ")}`).toBeLessThanOrEqual(0);
    expect(await page.locator("h1").count(), `${name} should have one h1`).toBe(1);
    await page.screenshot({ path: `${OUT}/${name}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  findings[name] = results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.help}`), `${name} accessibility`).toEqual([]);
}

test.describe.serial("screens, overflow and accessibility", () => {
  const PUBLIC = [
    ["front", "/"],
    ["journal", "/journal"],
    ["article", "/articles/parking-appeals-at-pcc-a-proposal"],
    ["meetings", "/meetings"],
    ["submissions", "/submissions"],
    ["recognition", "/recognition"],
    ["about", "/about"],
    ["signup", "/signup"],
    ["not-found", "/articles/a-second-draft"],
  ] as const;

  for (const [name, path] of PUBLIC) {
    test(`public: ${name}`, async ({ page }) => {
      await page.goto(path);
      await check(page, name, ["front", "article", "journal", "meetings", "submissions", "recognition"].includes(name) ? [320, 375, 768, 1440] : [375, 1440]);
    });
  }

  test("signed in: author dashboard and draft editor", async ({ page }) => {
    await signIn(page, "avery@author.test", "author-pass-2026!");
    await page.goto("/dashboard");
    await check(page, "dashboard", [375, 1440]);
    await page.goto("/account");
    await check(page, "account", [320, 375, 768, 1440]);
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Start a submission" }).click();
    await page.getByRole("button", { name: "Create draft" }).click();
    await check(page, "manuscript-draft", [375, 1440]);
  });

  test("signed in: editor and administrator pages", async ({ page }) => {
    await signIn(page, "admin@demo.test");
    await page.goto("/editor?status=all");
    await check(page, "editor-queue", [375, 1440]);
    await page.getByRole("link", { name: "Parking Appeals at PCC: A Proposal" }).click();
    await check(page, "editor-manuscript", [375, 1440]);
    await page.goto("/admin/members");
    await check(page, "admin-members", [375, 1440]);
    await page.goto("/admin/badges");
    await check(page, "admin-badges", [320, 375, 768, 1440]);
    await page.goto("/admin/settings");
    await check(page, "admin-settings", [1440]);
    writeFileSync(`${OUT}/axe-findings.json`, JSON.stringify(findings, null, 2));
  });
});
