import type { Metadata } from "next";
import { Flash, FormNav, Page, flashFrom, type SearchParams } from "@/components/ui";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const { notice, error } = await flashFrom(searchParams);
  return (
    <Page title="Reset your password" lede="We’ll email you a link to choose a new password.">
      <Flash notice={notice} error={error} />
      <form className="form" method="post" action="/api/session/forgot-password">
        <FormNav back="/forgot-password" next="/forgot-password" />
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
        </div>
        <button className="button button-primary" type="submit">Email me a link</button>
      </form>
    </Page>
  );
}
