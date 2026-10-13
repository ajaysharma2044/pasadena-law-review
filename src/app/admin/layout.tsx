import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AccessDenied } from "@/components/ui";
import { pageAccess } from "@/server/session";

export const metadata: Metadata = { robots: { index: false } };

/** Every /admin page requires an active administrator; children never render otherwise. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const access = await pageAccess("/admin", ["admin"]);
  if (!access.ok) return <AccessDenied reason={access.reason} />;
  return <>{children}</>;
}
