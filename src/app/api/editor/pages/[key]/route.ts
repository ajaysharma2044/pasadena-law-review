import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { proposePage } from "@/server/services/cms";

export const POST = mutation<{ key: string }>(async (req, input, { key }) => {
  const actor = await requireActor(req.headers, ["editor", "admin"]);
  const r = await proposePage(actor, key, input.bodyMd ?? "", input.note ?? "");
  return { ok: true, ...r, notice: "page_proposed" };
});
