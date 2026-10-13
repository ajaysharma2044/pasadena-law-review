import type { Metadata } from "next";
import { AccessDenied, Flash, FormNav, Page, flashFrom, type SearchParams } from "@/components/ui";
import { pageAccess } from "@/server/session";

export const metadata: Metadata = { title: "Apply to be an editor", robots: { index: false } };

export default async function ApplyPage({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await flashFrom(searchParams);
  const access = await pageAccess("/account/apply");
  if (!access.ok) return <AccessDenied reason={access.reason} />;
  if (access.actor.role !== "member") {
    return <Page title="Apply to be an editor" lede="You already have editorial access." >{null}</Page>;
  }
  return (
    <Page title="Apply to be an editor" lede="Editors read submissions, recommend decisions, and help with cite-checks. An administrator reviews every application.">
      <Flash error={error} />
      <form className="form" method="post" action="/api/account/applications">
        <FormNav back="/account/apply" next="/account" />
        <div className="field">
          <label htmlFor="statement">Why do you want to edit for the Review?</label>
          <textarea id="statement" name="statement" required maxLength={4000} />
        </div>
        <div className="field">
          <label htmlFor="experience">Relevant experience (optional)</label>
          <textarea id="experience" name="experience" maxLength={4000} aria-describedby="exp-hint" />
          <p className="hint" id="exp-hint">Classes, writing, editing, debate. Don’t include student ID numbers or grades.</p>
        </div>
        <button className="button button-primary" type="submit">Send application</button>
      </form>
    </Page>
  );
}
