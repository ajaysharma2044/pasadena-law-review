import Link from "next/link";

const LINKS = [
  ["/editor", "Review queue"],
  ["/editor/meetings", "Meetings"],
  ["/editor/pages", "Pages"],
] as const;

export function EditorNav({ current }: { current: string }) {
  return (
    <ul className="subnav" aria-label="Editors">
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
