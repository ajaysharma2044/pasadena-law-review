import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { publishPageDirect } from "@/server/services/cms";

export const POST = mutation<{ key: string }>(async (req, input, { key }) => {
  const actor = await requireActor(req.headers, ["admin"]);
  await publishPageDirect(actor, key, input.bodyMd ?? "", input.note ?? "");
  return { ok: true, notice: "page_published" };
});
