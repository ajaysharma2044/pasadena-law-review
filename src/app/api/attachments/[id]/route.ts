import { requireActor } from "@/server/actor";
import { AppError } from "@/server/errors";
import { readAttachment } from "@/server/services/attachments";

/** Authorized download. Never cached, always served as a download, never sniffed by the browser. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(req.headers);
    const { id } = await ctx.params;
    const file = await readAttachment(actor, id);
    if (file.kind === "redirect") return new Response(null, { status: 302, headers: { Location: file.url, "Cache-Control": "no-store" } });
    return new Response(Buffer.from(file.bytes), {
      headers: {
        "Content-Type": file.meta.mime,
        "Content-Disposition": `attachment; filename="${file.meta.filename.replace(/"/g, "")}"`,
        "Content-Length": String(file.bytes.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    if (e instanceof AppError) return Response.json({ error: e.code }, { status: e.status });
    console.error(e);
    return Response.json({ error: "unexpected" }, { status: 500 });
  }
}
