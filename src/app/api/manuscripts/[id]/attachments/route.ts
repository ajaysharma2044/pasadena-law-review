import { requireActor } from "@/server/actor";
import { AppError } from "@/server/errors";
import { assertSameOrigin, redirectTo, safePath, wantsHtml } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { MAX_BYTES, uploadAttachment } from "@/server/services/attachments";

/** Multipart upload. Size is checked before the body is read, then again on the bytes. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const back = `/manuscripts/${id}`;
  const form = wantsHtml(req);
  try {
    assertSameOrigin(req);
    const actor = await requireActor(req.headers);
    await rateLimit(`upload:${actor.userId}`, 20, 3600);
    const declared = Number(req.headers.get("content-length") ?? "0");
    if (declared > MAX_BYTES + 64 * 1024) throw new AppError(422, "bad_file", "Upload a PDF or Word (.docx) file under 10 MB.");
    const data = await req.formData();
    const file = data.get("file");
    if (!file || typeof file === "string") throw new AppError(422, "bad_file", "Choose a file to upload.");
    const result = await uploadAttachment(actor, id, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    return form ? redirectTo(safePath(back, "/dashboard"), { notice: "attachment_added" }) : Response.json({ ok: true, id: result.id });
  } catch (e) {
    if (e instanceof AppError) {
      return form ? redirectTo(back, { error: e.code }) : Response.json({ error: e.code, message: e.message }, { status: e.status });
    }
    console.error(e);
    return form ? redirectTo(back, { error: "unexpected" }) : Response.json({ error: "unexpected" }, { status: 500 });
  }
}
