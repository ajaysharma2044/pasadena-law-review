import type { Metadata } from "next";
import Link from "next/link";
import { EditorNav } from "@/components/editor-nav";
import { Flash, Page, flashFrom, type SearchParams } from "@/components/ui";
import { listMeetings } from "@/server/services/cms";
import { formatMeetingTime } from "@/server/services/public-content";

export const metadata: Metadata = { title: "Meetings" };

const LABEL = { draft: "Draft (not public)", announced: "Announced", held: "Held", cancelled: "Cancelled" } as const;

export default async function MeetingsAdmin({ searchParams }: { searchParams: SearchParams }) {
  const { notice, error } = await flashFrom(searchParams);
  const rows = await listMeetings();
  return (
    <Page title="Meetings" lede="Editors can prepare drafts and minutes. An administrator announces meetings and publishes minutes." wide>
      <EditorNav current="/editor/meetings" />
      <Flash notice={notice} error={error} />
      <p>
        <Link className="button" href="/editor/meetings/new">New meeting</Link>
      </p>
      <table className="table">
        <caption className="sr-only">Meetings</caption>
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Motion</th>
            <th scope="col">Status</th>
            <th scope="col">Minutes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td>
                <Link href={`/editor/meetings/${m.id}`}>{m.startsAt ? formatMeetingTime(m.startsAt, m.timezone) : "Date not set"}</Link>
              </td>
              <td>{m.motion || "No motion yet"}</td>
              <td>{LABEL[m.status]}</td>
              <td>{m.minutesPublished ? "Published" : m.minutesMd ? "Draft" : "None"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Page>
  );
}
