import type { Metadata } from "next";
import Link from "next/link";
import { Flash, FormNav, Page, flashFrom, type SearchParams } from "@/components/ui";
import { safePath } from "@/server/http";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const { notice, error, one } = await flashFrom(searchParams);
  const next = safePath(one("next"), "/dashboard");
  return (
    <Page title="Sign in">
      <Flash notice={notice} error={error} />
      <form className="form" method="post" action="/api/session/sign-in">
        <FormNav back={`/signin?next=${encodeURIComponent(next)}`} next={next} />
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={128} />
        </div>
        <div className="actions">
          <button className="button button-primary" type="submit">Sign in</button>
          <span className="save-state">
            <Link href="/forgot-password">Forgot your password?</Link> · <Link href="/signup">Create an account</Link>
          </span>
        </div>
      </form>
      {error === "email_unverified" ? (
        <form className="form" method="post" action="/api/session/resend-verification">
          <h2>Send a new confirmation link</h2>
          <FormNav back="/signin" next="/signin" />
          <div className="field">
            <label htmlFor="resend-email">Email</label>
            <input id="resend-email" name="email" type="email" autoComplete="email" required />
          </div>
          <button className="button" type="submit">Send link</button>
        </form>
      ) : null}
    </Page>
  );
}
