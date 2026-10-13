import type { Metadata } from "next";
import Link from "next/link";
import { Flash, FormNav, Page, flashFrom, type SearchParams } from "@/components/ui";
import { currentActor } from "@/server/session";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

const PROBLEMS: Record<string, string> = {
  TOKEN_EXPIRED: "That confirmation link has expired. Ask for a new one below.",
  INVALID_TOKEN: "That confirmation link isn’t valid. Ask for a new one below.",
  USER_NOT_FOUND: "That confirmation link doesn’t match an account.",
};

export default async function VerifyEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const { notice, one } = await flashFrom(searchParams);
  const problem = one("error");
  const actor = await currentActor();
  if (!problem && actor?.emailVerified) {
    return (
      <Page title="Email confirmed" lede="Your account is ready.">
        <p>
          <Link className="button button-primary" href="/dashboard">Go to your dashboard</Link>
        </p>
      </Page>
    );
  }
  return (
    <Page title="Confirm your email">
      <Flash notice={notice} />
      {problem ? (
        <div className="notice notice-error" role="alert">
          {PROBLEMS[problem] ?? "That confirmation link didn’t work. Ask for a new one below."}
        </div>
      ) : (
        <p className="lede">Open the link we emailed you to confirm your address.</p>
      )}
      <form className="form" method="post" action="/api/session/resend-verification">
        <FormNav back="/verify-email" next="/verify-email" />
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <button className="button" type="submit">Send a new link</button>
      </form>
    </Page>
  );
}
