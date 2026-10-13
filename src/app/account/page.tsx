import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied, Flash, FormNav, Page, flashFrom, formatDateTime, type SearchParams } from "@/components/ui";
import { myApplications } from "@/server/services/applications";
import { getProfile } from "@/server/services/profile";
import { currentActor } from "@/server/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

const ROLE_LABEL = { member: "Author (member)", editor: "Editor", admin: "Administrator" } as const;

export default async function AccountPage({ searchParams }: { searchParams: SearchParams }) {
  const { notice, error } = await flashFrom(searchParams);
  const actor = await currentActor();
  if (!actor) redirect("/signin?next=%2Faccount");
  if (actor.status === "suspended") return <AccessDenied reason="suspended" />;
  const [profile, applications] = await Promise.all([getProfile(actor.userId), myApplications(actor)]);
  return (
    <Page title="Your account">
      <Flash notice={notice} error={error} />
      {actor.status === "pending" ? (
        <div className="notice" role="status">Your account is waiting for an administrator’s approval.</div>
      ) : null}
      <dl className="facts-inline">
        <dt>Name</dt>
        <dd>{actor.name}</dd>
        <dt>Email</dt>
        <dd>{actor.email}</dd>
        <dt>Access</dt>
        <dd>{ROLE_LABEL[actor.role]}</dd>
      </dl>

      <h2>Public profile</h2>
      <p>This is how your byline and bio appear on published work.</p>
      <form className="form" method="post" action="/api/account/profile">
        <FormNav back="/account" next="/account" />
        <div className="field">
          <label htmlFor="displayName">Public name</label>
          <input id="displayName" name="displayName" type="text" required maxLength={120} defaultValue={profile?.displayName ?? actor.name} />
        </div>
        <div className="field">
          <label htmlFor="bio">Short bio (optional)</label>
          <textarea id="bio" name="bio" maxLength={1200} defaultValue={profile?.bio ?? ""} />
        </div>
        <button className="button" type="submit">Save profile</button>
      </form>

      <h2>Editorial access</h2>
      {actor.role === "member" ? (
        <>
          {applications.length ? (
            <ul className="thread">
              {applications.map((a) => (
                <li key={a.id}>
                  <p className="byline">Applied {formatDateTime(a.createdAt)}: {a.status === "pending" ? "waiting for a decision" : a.status}</p>
                  {a.decisionNote ? <p>Note from the editors: {a.decisionNote}</p> : null}
                  {a.status === "pending" ? (
                    <form method="post" action={`/api/account/applications/${a.id}/withdraw`} className="inline-form">
                      <FormNav back="/account" next="/account" />
                      <button className="button" type="submit">Withdraw application</button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p>You can submit writing as a member. Editors also review submissions and edit pages.</p>
          )}
          {applications.some((a) => a.status === "pending") ? null : (
            <p>
              <Link className="button" href="/account/apply">Apply to be an editor</Link>
            </p>
          )}
        </>
      ) : (
        <p>
          You have editorial access. <Link href="/editor">Open the review queue</Link>
          {actor.role === "admin" ? (
            <>
              {" "}or <Link href="/admin">the administration pages</Link>
            </>
          ) : null}
          .
        </p>
      )}

      <h2>Password</h2>
      <form className="form" method="post" action="/api/session/change-password">
        <FormNav back="/account" next="/account" />
        <div className="field">
          <label htmlFor="current_password">Current password</label>
          <input id="current_password" name="current_password" type="password" autoComplete="current-password" required />
        </div>
        <div className="field">
          <label htmlFor="new_password">New password</label>
          <input id="new_password" name="new_password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} />
        </div>
        <div className="field">
          <label htmlFor="new_password_confirm">New password again</label>
          <input id="new_password_confirm" name="new_password_confirm" type="password" autoComplete="new-password" required minLength={10} maxLength={128} />
        </div>
        <button className="button" type="submit">Change password</button>
      </form>
    </Page>
  );
}
