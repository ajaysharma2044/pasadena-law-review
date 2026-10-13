import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { DevBanner, SiteFooter, SiteHeader } from "@/components/chrome";
import { isAdmin, isEditor } from "@/server/actor";
import { getConfig } from "@/server/config";
import { currentActor } from "@/server/session";
import { getSettings } from "@/server/services/settings";
import "./journal.css";

export const dynamic = "force-dynamic";

const FONTS =
  "https://fonts.googleapis.com/css2?family=Charis+SIL:ital,wght@0,400;0,700;1,400&family=Libre+Franklin:wght@400;600;700&family=Old+Standard+TT:ital,wght@0,400;0,700;1,400&display=swap";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { default: s.publication_name, template: `%s | ${s.publication_name}` },
    description: `${s.publication_tagline}. Essays, policy proposals, notes, and meetings.`,
    icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [settings, config, actor] = [await getSettings(), getConfig(), await currentActor().catch(() => null)];
  const accountLinks = actor ? (
    <>
      <li>
        <Link href="/dashboard">Dashboard</Link>
      </li>
      {isEditor(actor) ? (
        <li>
          <Link href="/editor">Editor</Link>
        </li>
      ) : null}
      {isAdmin(actor) ? (
        <li>
          <Link href="/admin">Admin</Link>
        </li>
      ) : null}
      <li>
        <Link href="/account">Account</Link>
      </li>
      <li>
        <form method="post" action="/api/session/sign-out">
          <button type="submit">Sign out</button>
        </form>
      </li>
    </>
  ) : (
    <>
      <li>
        <Link href="/signin">Sign in</Link>
      </li>
      <li>
        <Link href="/signup">Sign up</Link>
      </li>
    </>
  );
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>
        <a className="skip" href="#content">
          Skip to content
        </a>
        <DevBanner mode={config.mode} />
        <SiteHeader
          settings={settings}
          accountLinks={accountLinks}
        />
        {children}
        <SiteFooter settings={settings} />
      </body>
    </html>
  );
}
