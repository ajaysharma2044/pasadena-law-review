import type { Metadata } from "next";
import Link from "next/link";
import { Flash, FormNav, Page, flashFrom, type SearchParams } from "@/components/ui";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false }, referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const { error, one } = await flashFrom(searchParams);
  const token = one("token");
  if (!token || error === "INVALID_TOKEN") {
    return (
      <Page title="Choose a new password">
        <div className="notice notice-error" role="alert">
          That reset link is invalid or has expired. <Link href="/forgot-password">Ask for a new one</Link>.
        </div>
      </Page>
    );
  }
  return (
    <Page title="Choose a new password" lede="This signs you out on every device.">
      <Flash error={error} />
      <form className="form" method="post" action="/api/session/reset-password">
        <FormNav back={`/reset-password?token=${encodeURIComponent(token)}`} next="/signin" />
        <input type="hidden" name="token" value={token} />
        <div className="field">
          <label htmlFor="password">New password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} />
          <p className="hint">At least 10 characters.</p>
        </div>
        <div className="field">
          <label htmlFor="password_confirm">New password again</label>
          <input id="password_confirm" name="password_confirm" type="password" autoComplete="new-password" required minLength={10} maxLength={128} />
        </div>
        <button className="button button-primary" type="submit">Change password</button>
      </form>
    </Page>
  );
}
