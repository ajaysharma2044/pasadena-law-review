import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AccessDenied } from "@/components/ui";
import { pageAccess } from "@/server/session";

export const metadata: Metadata = { robots: { index: false } };

/** Every /editor page requires an active editor or administrator. */
export default async function EditorLayout({ children }: { children: ReactNode }) {
  const access = await pageAccess("/editor", ["editor", "admin"]);
  if (!access.ok) return <AccessDenied reason={access.reason} />;
  return <>{children}</>;
}
