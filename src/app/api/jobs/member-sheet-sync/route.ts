import { createHash, timingSafeEqual } from "node:crypto";
import { getConfig } from "@/server/config";
import { memberSheetConfig, syncMemberSheet } from "@/server/services/member-sheet-sync";

/** Scheduler-only. Never returns member data or Google error bodies. */
export async function POST(req: Request) {
  const expected = getConfig().cronSecret;
  const supplied = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const hash = (s: string) => createHash("sha256").update(s).digest();
  if (!expected || !timingSafeEqual(hash(expected), hash(supplied))) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const config = memberSheetConfig();
    if (!config) return Response.json({ status: "not_configured" });
    return Response.json({ status: "synced", ...await syncMemberSheet(config) });
  } catch {
    // Credentials and member data must not appear in logs or responses.
    console.error("Member sheet sync failed; check Google authorization and spreadsheet configuration.");
    return Response.json({ error: "sheet_sync_failed" }, { status: 502 });
  }
}
