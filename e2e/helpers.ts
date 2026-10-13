import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "demo-pass-2026!";
export const ORIGIN = "http://localhost:3300";

export async function signIn(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
}

/** Reads the newest link of a kind from the development mailbox page. */
export async function mailboxLink(page: Page, to: string, pathPart: string) {
  await page.goto("/dev/mailbox");
  const section = page.locator("section", { hasText: `To ${to}` }).first();
  const text = await section.innerText();
  const m = text.match(new RegExp(`https?://\\S*${pathPart}\\S*`));
  if (!m) throw new Error(`no ${pathPart} link for ${to}`);
  return m[0];
}

export async function signUpAndVerify(page: Page, name: string, email: string, password = "author-pass-2026!") {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Password again").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  const link = await mailboxLink(page, email, "/api/auth/verify-email");
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Email confirmed" })).toBeVisible();
  // Confirming doesn't sign you in; that stays a separate step.
  await expect(page.getByRole("main").getByRole("link", { name: "Sign in" })).toBeVisible();
  return password;
}
