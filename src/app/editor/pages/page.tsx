import type { Metadata } from "next";
import Link from "next/link";
import { EditorNav } from "@/components/editor-nav";
import { Flash, Page, flashFrom, type SearchParams } from "@/components/ui";
import { pagesOverview } from "@/server/services/cms";

export const metadata: Metadata = { title: "Pages" };

export default async function PagesIndex({ searchParams }: { searchParams: SearchParams }) {
  const { notice, error } = await flashFrom(searchParams);
  const pages = await pagesOverview();
  return (
    <Page title="Pages" lede="Editors propose changes to these pages. An administrator publishes them." wide>
      <EditorNav current="/editor/pages" />
      <Flash notice={notice} error={error} />
      <table className="table">
        <caption className="sr-only">Editable pages</caption>
        <thead>
          <tr>
            <th scope="col">Page</th>
            <th scope="col">Public now</th>
            <th scope="col">Proposals waiting</th>
          </tr>
        </thead>
        <tbody>
          {pages.map((p) => (
            <tr key={p.key}>
              <td>
                <Link href={`/editor/pages/${p.key}`}>{p.label}</Link>
              </td>
              <td>{p.published ? "Yes" : "Not published"}</td>
              <td>{p.proposed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Page>
  );
}
