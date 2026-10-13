import Link from "next/link";

const LINKS = [
  ["/admin", "Overview"],
  ["/admin/manuscripts", "Manuscripts"],
  ["/admin/members", "Members"],
  ["/admin/applications", "Applications"],
  ["/admin/issues", "Issues"],
  ["/admin/meetings", "Meetings"],
  ["/admin/pages", "Pages"],
  ["/admin/settings", "Settings"],
  ["/admin/email", "Email"],
  ["/admin/audit", "Audit log"],
] as const;

export function AdminNav({ current }: { current: string }) {
  return (
    <ul className="subnav" aria-label="Administration">
      {LINKS.map(([href, label]) => (
        <li key={href}>
          <Link href={href} aria-current={href === current ? "page" : undefined}>
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
