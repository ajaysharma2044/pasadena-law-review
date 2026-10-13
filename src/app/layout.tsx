import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { DevBanner, SiteFooter, SiteHeader } from "@/components/chrome";
import { getConfig } from "@/server/config";
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
  const [settings, config] = [await getSettings(), getConfig()];
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
          accountLinks={
            <li>
              <Link href="/signin">Sign in</Link>
            </li>
          }
        />
        {children}
        <SiteFooter settings={settings} />
      </body>
    </html>
  );
}
