import Link from "next/link";
import type { ReactNode } from "react";
import type { Settings } from "@/server/services/settings";

const SECTIONS = [
  { href: "/journal", label: "Journal" },
  { href: "/meetings", label: "Meetings" },
  { href: "/submissions", label: "Submissions" },
  { href: "/about", label: "About" },
];

/** Splits the name before the word preceding "&" so phones get "The Pasadena / Law & Policy Review". */
export function NameplateName({ name }: { name: string }) {
  const words = name.split(" ");
  const amp = words.indexOf("&");
  const render = (text: string) =>
    text.split(" & ").flatMap((part, i) => (i === 0 ? [part] : [" ", <em key={i}>&amp;</em>, " ", part]));
  if (amp > 1) {
    return (
      <>
        <span>{words.slice(0, amp - 1).join(" ")}</span> <span>{render(words.slice(amp - 1).join(" "))}</span>
      </>
    );
  }
  return <span>{render(name)}</span>;
}

export function DevBanner({ mode }: { mode: "development" | "test" | "production" | "local-preview" }) {
  if (mode === "production") return null;
  const text =
    mode === "local-preview"
      ? "Local preview of a production build: local database and development mailbox. Not for real use."
      : "Development copy: local database (PGlite), development mailbox, local file storage. Nothing here is sent or public.";
  return (
    <p className="dev-banner" role="note">
      {text}
    </p>
  );
}

export function SiteHeader({ settings, accountLinks }: { settings: Settings; accountLinks: ReactNode }) {
  return (
    <header>
      <nav className="sections" aria-label="Sections">
        <div className="wrap-nav">
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <Link href={s.href}>{s.label}</Link>
              </li>
            ))}
          </ul>
          <ul aria-label="Account">{accountLinks}</ul>
        </div>
      </nav>
      <p className="nameplate">
        {settings.publication_tagline ? <small>{settings.publication_tagline}</small> : null}
        <Link href="/">
          <NameplateName name={settings.publication_name} />
        </Link>
        {settings.nameplate_issue_line ? <span className="issue">{settings.nameplate_issue_line}</span> : null}
      </p>
    </header>
  );
}

export function SiteFooter({ settings }: { settings: Settings }) {
  const handle = settings.instagram_handle.replace(/^@/, "");
  return (
    <footer className="foot">
      <div className="wrap">
        <p className="foot-name">
          <NameplateName name={settings.publication_name} />
        </p>
        <p>
          Opinions are the authors’ own.
          {settings.contact_email ? (
            <>
              {" "}Write to <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>.
            </>
          ) : null}
          {handle ? (
            <>
              {" "}Instagram: <a href={`https://www.instagram.com/${encodeURIComponent(handle)}/`}>@{handle}</a>.
            </>
          ) : null}
        </p>
        <ul>
          {SECTIONS.map((s) => (
            <li key={s.href}>
              <Link href={s.href}>{s.label}</Link>
            </li>
          ))}
          <li>
            <Link href="/forum">Forum</Link>
          </li>
        </ul>
        <p>© {new Date().getFullYear()} {settings.publication_name}</p>
      </div>
    </footer>
  );
}
