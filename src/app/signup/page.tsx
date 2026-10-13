import type { Metadata } from "next";
import Link from "next/link";
import { Flash, FormNav, Page, flashFrom, type SearchParams } from "@/components/ui";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function SignUpPage({ searchParams }: { searchParams: SearchParams }) {
  const { notice, error } = await flashFrom(searchParams);
  return (
    <Page title="Create an account" lede="An account lets you submit writing and follow its status. Reading the journal never needs one.">
      <Flash notice={notice} error={error} />
      {notice === "check_email" ? null : (
        <form className="form" method="post" action="/api/session/sign-up">
          <FormNav back="/signup" next="/signup" />
          <div className="field">
            <label htmlFor="name">Your name</label>
            <input id="name" name="name" type="text" autoComplete="name" required maxLength={100} />
            <p className="hint">Private to the editors. You choose your public byline later.</p>
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} aria-describedby="password-hint" />
            <p className="hint" id="password-hint">At least 10 characters.</p>
          </div>
          <div className="field">
            <label htmlFor="password_confirm">Password again</label>
            <input id="password_confirm" name="password_confirm" type="password" autoComplete="new-password" required minLength={10} maxLength={128} />
          </div>
          <div className="actions">
            <button className="button button-primary" type="submit">Create account</button>
            <span className="save-state">
              Have an account? <Link href="/signin">Sign in</Link>
            </span>
          </div>
        </form>
      )}
    </Page>
  );
}
