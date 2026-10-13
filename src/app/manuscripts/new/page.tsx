import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied, Flash, FormNav, Page, flashFrom, type SearchParams } from "@/components/ui";
import { getSettings } from "@/server/services/settings";
import { pageAccess } from "@/server/session";

export const metadata: Metadata = { title: "Start a submission", robots: { index: false } };

const KINDS = [
  ["essay", "Essay", "An argument about a legal or policy question. 3,000–8,000 words."],
  ["proposal", "Proposal", "A specific change to a rule, policy, or procedure, with the language you want adopted."],
  ["note", "Note", "A close reading of one statute, case, or campus policy. 2,000–5,000 words."],
  ["forum", "Forum piece", "A reply to something we published or debated. Up to 1,500 words."],
] as const;

export default async function NewManuscript({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await flashFrom(searchParams);
  const access = await pageAccess("/manuscripts/new");
  if (!access.ok) return <AccessDenied reason={access.reason} />;
  const settings = await getSettings();
  if (!settings.submissions_open) {
    return (
      <Page title="Start a submission" lede="The Review isn’t reading new submissions right now.">
        <p>
          <Link href="/dashboard">Back to your dashboard</Link>
        </p>
      </Page>
    );
  }
  return (
    <Page title="Start a submission" lede="Pick the kind of piece. You can change it before you submit.">
      <Flash error={error} />
      <form className="form" method="post" action="/api/manuscripts">
        <FormNav back="/manuscripts/new" />
        <fieldset>
          <legend>Kind of piece</legend>
          {KINDS.map(([value, label, hint], i) => (
            <div className="checkbox" key={value}>
              <input type="radio" id={`kind-${value}`} name="kind" value={value} defaultChecked={i === 0} />
              <label htmlFor={`kind-${value}`}>
                <strong>{label}.</strong> {hint}
              </label>
            </div>
          ))}
        </fieldset>
        <button className="button button-primary" type="submit">Create draft</button>
      </form>
    </Page>
  );
}
