import { BlobsServer } from "@netlify/blobs/server";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/server/errors";
import * as att from "@/server/services/attachments";
import * as m from "@/server/services/manuscripts";
import { netlifyBlobStorageForTests, setStorageForTests } from "@/server/storage";
import { setupApp } from "./helpers/app";
import { actor } from "./helpers/actors";

const enc = (s: string) => new TextEncoder().encode(s);
const PDF = enc("%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF");
const DOCX = enc("PK\u0003\u0004....[Content_Types].xml....word/document.xml....");
const DOCM = enc("PK\u0003\u0004....[Content_Types].xml....word/document.xml....word/vbaProject.bin");
const EXE = enc("MZ\u0090\u0000 this is a windows executable");

let handle: Awaited<ReturnType<typeof setupApp>>;
beforeEach(async () => {
  handle = await setupApp();
});
afterEach(async () => {
  setStorageForTests(null);
  await handle.close();
});

async function expectStatus(p: Promise<unknown>, status: number) {
  await p.then(
    () => {
      throw new Error(`expected ${status}`);
    },
    (e) => {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).status).toBe(status);
    },
  );
}

describe("attachment validation", () => {
  it("accepts real PDF and DOCX content with matching names", () => {
    expect(att.sniff(PDF, "paper.pdf")).toBe("pdf");
    expect(att.sniff(DOCX, "paper.docx")).toBe("docx");
  });

  it.each([
    ["an executable renamed to .pdf", EXE, "paper.pdf"],
    ["a PDF named .docx", PDF, "paper.docx"],
    ["a macro-enabled document", DOCM, "paper.docx"],
    ["a .docm file", DOCX, "paper.docm"],
    ["plain text", enc("hello"), "notes.txt"],
  ])("rejects %s", (_l, bytes, name) => {
    expect(() => att.sniff(bytes, name)).toThrow(AppError);
  });

  it("strips paths and odd characters from display names", () => {
    expect(att.cleanFilename("../../etc/passwd")).toBe("passwd");
    expect(att.cleanFilename("C:\\Users\\x\\My <Essay>.docx")).toBe("My _Essay_.docx");
  });
});

describe("attachment access", () => {
  it("lets the author upload and download; other authors can't; editors can once submitted", async () => {
    const author = await actor();
    const other = await actor();
    const editor = await actor("editor");
    const { id } = await m.createDraft(author, "essay");
    const up = await att.uploadAttachment(author, id, { name: "paper.pdf", bytes: PDF });
    const mine = await att.readAttachment(author, up.id);
    expect(mine.kind).toBe("bytes");
    if (mine.kind === "bytes") expect(Buffer.from(mine.bytes).equals(Buffer.from(PDF))).toBe(true);

    await expectStatus(att.readAttachment(other, up.id), 404);
    await expectStatus(att.readAttachment(editor, up.id), 404); // still a private draft
    await expectStatus(att.uploadAttachment(other, id, { name: "x.pdf", bytes: PDF }), 404);
    await expectStatus(att.removeAttachment(other, up.id), 404);

    const saved = await m.saveDraft(author, id, 1, { title: "T", bodyMd: "Body" });
    await m.submit(author, id, saved.version, { authorship: true, sources: true, disclosure: true });
    expect((await att.readAttachment(editor, up.id)).kind).toBe("bytes");
    await expectStatus(att.uploadAttachment(author, id, { name: "late.pdf", bytes: PDF }), 409); // locked under review
  });

  it("refuses oversized files", async () => {
    const author = await actor();
    const { id } = await m.createDraft(author, "essay");
    const big = new Uint8Array(att.MAX_BYTES + 1);
    big.set(PDF);
    await expectStatus(att.uploadAttachment(author, id, { name: "big.pdf", bytes: big }), 422);
  });
});

describe("Netlify Blobs driver", () => {
  it("stores, reads and deletes through the Blobs API (local Blobs server)", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "plr-blobs-"));
    const token = "test-token";
    const server = new BlobsServer({ directory: dir, token, port: 0 });
    const { port } = await server.start();
    try {
      const store = netlifyBlobStorageForTests("manuscript-attachments", { siteID: "local-site", token, apiURL: `http://localhost:${port}` });
      const key = "3f1c2a9e-1b2c-4d5e-8f90-123456789abc";
      await store.put(key, PDF, "application/pdf");
      const back = await store.get(key);
      expect(back && Buffer.from(back).equals(Buffer.from(PDF))).toBe(true);
      await store.remove(key);
      expect(await store.get(key)).toBeNull();
      await expect(store.put("../escape", PDF, "application/pdf")).rejects.toThrow(/invalid storage key/);
    } finally {
      await server.stop();
    }
  });
});
