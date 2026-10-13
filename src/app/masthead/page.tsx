import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedMasthead } from "@/server/services/public-content";

export const metadata: Metadata = { title: "Masthead" };

export default async function MastheadPage() {
  const entries = await getPublishedMasthead();
  if (!entries) notFound();
  return (
    <main id="content">
      <div className="page-head narrow">
        <h1>Masthead</h1>
      </div>
      <div className="page narrow">
        <dl className="staff">
          {entries.map((e) => (
            <div key={e.id}>
              <dt>{e.roleTitle}</dt>
              <dd>{e.personName}</dd>
            </div>
          ))}
        </dl>
      </div>
    </main>
  );
}
