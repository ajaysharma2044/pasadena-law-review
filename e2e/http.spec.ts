import { expect, test, type APIRequestContext } from "@playwright/test";
import { signIn, signOut, signUpAndVerify } from "./helpers";

// Request-level checks against the production build: things a browser journey doesn't show.

test.describe("HTTP boundaries", () => {
  test("old static-site addresses redirect permanently to the new pages", async ({ request }) => {
    const legacy = [
      ["/index.html", "/"],
      ["/issues.html", "/journal"],
      ["/meetings.html", "/meetings"],
      ["/submissions.html", "/submissions"],
      ["/about.html", "/about"],
      ["/masthead.html", "/masthead"],
      ["/articles/a-second-draft.html", "/articles/a-second-draft"],
    ];
    for (const [from, to] of legacy) {
      const res = await request.get(from, { maxRedirects: 0 });
      expect(res.status(), from).toBe(308);
      expect(new URL(res.headers()["location"], "http://localhost").pathname, from).toBe(to);
    }
  });

  test("health reports the database without revealing settings", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("no-store");
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.database.state).toBe("up");
    expect(body.database.migrationsApplied).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(body)).not.toMatch(/postgres:\/\/|secret|re_/i);
  });

  test("pages carry the security headers and a fresh CSP nonce on every request", async ({ request }) => {
    const nonces = [];
    for (let i = 0; i < 2; i++) {
      const res = await request.get("/");
      const h = res.headers();
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(h["permissions-policy"]).toContain("camera=()");
      expect(h["strict-transport-security"]).toContain("max-age=");
      expect(h["x-powered-by"]).toBeUndefined();
      const csp = h["content-security-policy"];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).not.toContain("unsafe-eval");
      nonces.push(/'nonce-([^']+)'/.exec(csp)?.[1]);
    }
    expect(nonces[0]).toBeTruthy();
    expect(nonces[0]).not.toBe(nonces[1]);
  });

  test("private pages ask search engines not to index them, and robots.txt disallows them", async ({ request }) => {
    for (const path of ["/signin", "/signup", "/forgot-password", "/dashboard", "/account", "/editor", "/admin"]) {
      const html = await (await request.get(path)).text();
      expect(html, path).toMatch(/<meta name="robots" content="noindex"/);
    }
    const robots = await (await request.get("/robots.txt")).text();
    for (const path of ["/account", "/dashboard", "/manuscripts", "/editor", "/admin", "/api"]) {
      expect(robots).toContain(`Disallow: ${path}`);
    }
  });

  test("keyboard: the skip link comes first, focus is always visible, and landmarks are in place", async ({ page }) => {
    await page.goto("/");
    expect(await page.locator("main").count()).toBe(1);
    for (const landmark of ["header", "nav", "footer"]) expect(await page.locator(landmark).count(), landmark).toBeGreaterThan(0);
    await page.keyboard.press("Tab");
    const skip = page.locator("a.skip");
    await expect(skip).toBeFocused();
    expect((await skip.boundingBox())!.x).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < 12; i++) {
      const style = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const cs = getComputedStyle(el);
        return { tag: el.tagName, outline: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
      });
      expect(style.outline, `focus ring on ${style.tag} #${i}`).not.toBe("none");
      expect(style.width).toBeGreaterThanOrEqual(2);
      await page.keyboard.press("Tab");
    }
  });

  test("unpublished work isn't public, and protected endpoints refuse outsiders", async ({ request }) => {
    expect((await request.get("/articles/a-second-draft")).status()).toBe(404);
    expect((await request.post("/api/jobs/run")).status()).toBe(401);
    expect((await request.post("/api/jobs/run", { headers: { authorization: "Bearer wrong-secret-wrong-secret-00" } })).status()).toBe(401);
    // A cross-site form post is refused before anything else happens.
    const cross = await request.post("/api/session/sign-in", {
      headers: { origin: "https://elsewhere.example", accept: "application/json" },
      form: { email: "admin@demo.test", password: "anything-at-all" },
    });
    expect(cross.status()).toBe(403);
    // Private API routes need a session.
    expect((await request.post("/api/manuscripts", { headers: { origin: "http://localhost:3300", accept: "application/json" }, form: { kind: "essay" } })).status()).toBe(401);
  });
});

/**
 * A client-side navigation (React Server Components) request that claims the browser is already on the
 * section's index page. Next.js then renders only the segments below it, so the section's layout never runs:
 * every page has to check access itself.
 */
async function rscPayload(request: APIRequestContext, path: string, section: string) {
  const tree = encodeURIComponent(JSON.stringify(["", { children: [section, { children: ["__PAGE__", {}] }] }]));
  const headers = { RSC: "1", "Next-Router-State-Tree": tree };
  let res = await request.get(path, { headers, maxRedirects: 0 });
  for (let i = 0; i < 3 && res.status() >= 300 && res.status() < 400; i++) {
    res = await request.get(new URL(res.headers()["location"], "http://localhost:3300").toString(), { headers, maxRedirects: 0 });
  }
  return res.text();
}

// Text that only the real page (not an access message) would contain.
const PRIVATE: [path: string, section: string, marker: string][] = [
  ["/admin/members", "admin", "editor2@demo.test"],
  ["/admin/audit", "admin", "seed.content"],
  ["/admin/settings", "admin", "contact_email"],
  ["/admin/applications", "admin", "/admin/audit"],
  ["/admin/email", "admin", "/admin/audit"],
  ["/admin/issues", "admin", "/admin/audit"],
  ["/editor/meetings", "editor", "Restorative Resolution"],
  ["/editor/pages", "editor", "Front-page note from the editors"],
  ["/editor/pages/about", "editor", "Propose"],
];

test.describe("page-level access on client navigations", () => {
  test("anonymous visitors get nothing from admin or editor pages", async ({ request }) => {
    for (const [path, section, marker] of PRIVATE) {
      expect(await rscPayload(request, path, section), path).not.toContain(marker);
    }
    expect(await rscPayload(request, "/editor", "editor")).not.toContain("A Second Draft");
  });

  test("a member gets nothing from editor pages, and an editor nothing from admin pages", async ({ page }) => {
    await signUpAndVerify(page, "Rsc Member", "rsc-member@example.test");
    await signIn(page, "rsc-member@example.test", "author-pass-2026!");
    for (const [path, section, marker] of PRIVATE) {
      expect(await rscPayload(page.request, path, section), `member: ${path}`).not.toContain(marker);
    }
    expect(await rscPayload(page.request, "/editor", "editor"), "member: queue").not.toContain("A Second Draft");
    await signOut(page);
    await signIn(page, "editor1@demo.test");
    for (const [path, section, marker] of PRIVATE.filter(([, s]) => s === "admin")) {
      expect(await rscPayload(page.request, path, section), `editor: ${path}`).not.toContain(marker);
    }
    // The same request shape does work for someone allowed to see the page.
    expect(await rscPayload(page.request, "/editor/meetings", "editor")).toContain("Restorative Resolution");
  });
});

test.describe("browser console", () => {
  test("pages run without console errors, uncaught exceptions or CSP violations", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(`${new URL(page.url()).pathname}: ${m.text()}`);
    });
    page.on("pageerror", (e) => problems.push(`${new URL(page.url()).pathname}: ${e.message}`));
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) =>
        console.error(`CSP blocked ${e.effectiveDirective}: ${e.blockedURI || "inline"}`),
      );
    });
    const visit = async (path: string) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    };
    for (const path of ["/", "/journal", "/forum", "/meetings", "/submissions", "/about", "/signin", "/signup"]) await visit(path);
    // Client-side navigation (React Server Components requests) between pages.
    await page.getByRole("banner").getByRole("link", { name: "Meetings", exact: true }).click();
    await expect(page).toHaveURL(/\/meetings$/);
    await page.getByRole("banner").getByRole("link", { name: "Journal", exact: true }).click();
    await expect(page).toHaveURL(/\/journal$/);

    await signIn(page, "admin@demo.test");
    for (const path of ["/dashboard", "/account", "/editor", "/editor/pages", "/editor/meetings", "/admin", "/admin/members", "/admin/settings", "/admin/email", "/admin/audit"]) {
      await visit(path);
    }
    // The draft editor: toolbar and live preview (client code plus a fetch to /api/preview).
    await visit("/manuscripts/new");
    await page.getByLabel(/Essay\./).check();
    await page.getByRole("button", { name: "Create draft" }).click();
    await page.getByLabel("Text, with notes").fill("A claim.[^1]\n\n[^1]: *See* :sc[Cal. Educ. Code] § 76030.");
    await page.getByRole("button", { name: "Preview below" }).click();
    await expect(page.getByRole("region", { name: "Preview" })).toContainText("A claim.");
    expect(problems).toEqual([]);
  });
});
