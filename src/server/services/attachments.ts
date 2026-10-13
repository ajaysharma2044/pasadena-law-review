import { and, eq, isNull } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { assertActive, type Actor } from "../actor";
import { audit } from "../audit";
import { getDb } from "../db/client";
import { attachments, manuscripts } from "../db/schema";
import { AppError, notFound } from "../errors";
import { getStorage } from "../storage";

export const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;

const MIME = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

const badFile = (msg = "Upload a PDF or Word (.docx) file under 10 MB.") => new AppError(422, "bad_file", msg);

function includes(bytes: Uint8Array, needle: string) {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).includes(needle, 0, "latin1");
}

/** Decides the type from the content, never from the name or the browser's claim. */
export function sniff(bytes: Uint8Array, filename: string): keyof typeof MIME {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const head = Buffer.from(bytes.subarray(0, 8)).toString("latin1");
  if (head.startsWith("%PDF-")) {
    if (ext !== "pdf") throw badFile("The file is a PDF but its name doesn’t end in .pdf.");
    return "pdf";
  }
  if (head.startsWith("PK\u0003\u0004")) {
    if (ext !== "docx") throw badFile("Only Word .docx files are accepted (not .docm or other archives).");
    if (!includes(bytes, "[Content_Types].xml") || !includes(bytes, "word/document.xml")) throw badFile("That doesn’t look like a Word document.");
    if (includes(bytes, "vbaProject.bin") || includes(bytes, "macroEnabled")) throw badFile("Documents with macros aren’t accepted.");
    return "docx";
  }
  throw badFile();
}

/** Display-only name: no paths, no control characters, limited length. */
export function cleanFilename(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^\w.\- ()]+/g, "_").replace(/^\.+/, "").slice(-120);
  return cleaned || "file";
}

async function ownEditableManuscript(actor: Actor, manuscriptId: string) {
  const [m] = await getDb().select().from(manuscripts).where(eq(manuscripts.id, manuscriptId));
  if (!m || m.authorId !== actor.userId) throw notFound();
  if (m.status !== "draft" && m.status !== "changes_requested") {
    throw new AppError(409, "invalid_transition", "Files can be changed only while the piece is a draft or after changes are requested.");
  }
  return m;
}

export async function uploadAttachment(actor: Actor, manuscriptId: string, file: { name: string; bytes: Uint8Array }) {
  assertActive(actor);
  await ownEditableManuscript(actor, manuscriptId);
  if (file.bytes.byteLength === 0 || file.bytes.byteLength > MAX_BYTES) throw badFile();
  const filename = cleanFilename(file.name);
  const type = sniff(file.bytes, filename);
  const db = getDb();
  const existing = await db.select({ id: attachments.id }).from(attachments).where(and(eq(attachments.manuscriptId, manuscriptId), isNull(attachments.deletedAt)));
  if (existing.length >= MAX_FILES) throw new AppError(422, "bad_file", `A submission can have at most ${MAX_FILES} files.`);
  const key = randomUUID();
  await getStorage().put(key, file.bytes, MIME[type]);
  const [row] = await db
    .insert(attachments)
    .values({
      manuscriptId,
      uploaderId: actor.userId,
      storageKey: key,
      filename,
      mime: MIME[type],
      sizeBytes: file.bytes.byteLength,
      sha256: createHash("sha256").update(file.bytes).digest("hex"),
    })
    .returning({ id: attachments.id });
  await audit(db, { actorId: actor.userId, action: "attachment.upload", targetType: "manuscript", targetId: manuscriptId, metadata: { attachment: row.id, type } });
  return { id: row.id };
}

/** Authors can always download their own files; editors only once the piece is out of draft and not their own. */
export async function authorizeDownload(actor: Actor, attachmentId: string) {
  assertActive(actor);
  const db = getDb();
  const [row] = await db
    .select({ a: attachments, authorId: manuscripts.authorId, status: manuscripts.status, submitted: manuscripts.currentRevisionId })
    .from(attachments)
    .innerJoin(manuscripts, eq(manuscripts.id, attachments.manuscriptId))
    .where(and(eq(attachments.id, attachmentId), isNull(attachments.deletedAt)));
  if (!row) throw notFound();
  const own = row.authorId === actor.userId;
  // Editors see files only once the piece has been submitted (a draft withdrawn unsent stays private).
  const editorial = (actor.role === "editor" || actor.role === "admin") && row.status !== "draft" && row.submitted !== null && !own;
  if (!own && !editorial) throw notFound();
  return row.a;
}

export async function readAttachment(actor: Actor, attachmentId: string) {
  const a = await authorizeDownload(actor, attachmentId);
  const storage = getStorage();
  if (storage.signedUrl) return { kind: "redirect" as const, url: await storage.signedUrl(a.storageKey, a.filename, 60), meta: a };
  const bytes = await storage.get(a.storageKey);
  if (!bytes) throw notFound();
  return { kind: "bytes" as const, bytes, meta: a };
}

export async function removeAttachment(actor: Actor, attachmentId: string) {
  assertActive(actor);
  const db = getDb();
  const [a] = await db.select().from(attachments).where(and(eq(attachments.id, attachmentId), isNull(attachments.deletedAt)));
  if (!a) throw notFound();
  await ownEditableManuscript(actor, a.manuscriptId);
  await db.update(attachments).set({ deletedAt: new Date() }).where(eq(attachments.id, attachmentId));
  await getStorage().remove(a.storageKey);
  await audit(db, { actorId: actor.userId, action: "attachment.remove", targetType: "manuscript", targetId: a.manuscriptId, metadata: { attachment: attachmentId } });
  return a.manuscriptId;
}
