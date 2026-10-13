import { AwsClient } from "aws4fetch";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getConfig } from "./config";

/**
 * Private object storage for manuscript attachments. Keys are random and never derived from
 * user input. Nothing here is publicly addressable; downloads go through an authorized route.
 */
export interface Storage {
  readonly driver: string;
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  remove(key: string): Promise<void>;
  /** Short-lived URL for direct download, if the driver supports it. */
  signedUrl?(key: string, filename: string, seconds: number): Promise<string>;
}

const KEY_RE = /^[a-f0-9-]{36}$/;
function assertKey(key: string) {
  if (!KEY_RE.test(key)) throw new Error("invalid storage key");
}

class LocalStorage implements Storage {
  readonly driver = "local";
  constructor(private readonly dir: string) {}
  private file(key: string) {
    assertKey(key);
    return path.join(path.resolve(this.dir), key);
  }
  async put(key: string, bytes: Uint8Array) {
    await mkdir(path.resolve(this.dir), { recursive: true });
    await writeFile(this.file(key), bytes, { flag: "wx" });
  }
  async get(key: string) {
    try {
      return new Uint8Array(await readFile(this.file(key)));
    } catch {
      return null;
    }
  }
  async remove(key: string) {
    await rm(this.file(key), { force: true });
  }
}

type BlobStore = {
  set(key: string, value: ArrayBuffer | Blob | string, opts?: { metadata?: Record<string, unknown> }): Promise<unknown>;
  get(key: string, opts: { type: "arrayBuffer" }): Promise<ArrayBuffer | null>;
  delete(key: string): Promise<void>;
};

class NetlifyBlobStorage implements Storage {
  readonly driver = "netlify-blobs";
  private store: Promise<BlobStore>;
  constructor(name: string, explicit?: { siteID: string; token: string; apiURL?: string }) {
    this.store = import("@netlify/blobs").then(({ getStore }) =>
      (explicit ? getStore({ name, consistency: "strong", ...explicit }) : getStore({ name, consistency: "strong" })) as unknown as BlobStore,
    );
  }
  async put(key: string, bytes: Uint8Array, contentType: string) {
    assertKey(key);
    const copy = bytes.slice();
    await (await this.store).set(key, copy.buffer, { metadata: { contentType } });
  }
  async get(key: string) {
    assertKey(key);
    const buf = await (await this.store).get(key, { type: "arrayBuffer" });
    return buf ? new Uint8Array(buf) : null;
  }
  async remove(key: string) {
    assertKey(key);
    await (await this.store).delete(key);
  }
}

class S3Storage implements Storage {
  readonly driver = "s3";
  private client: AwsClient;
  constructor(private readonly c: { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string }) {
    this.client = new AwsClient({ accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey, region: c.region, service: "s3" });
  }
  private url(key: string) {
    assertKey(key);
    return `${this.c.endpoint.replace(/\/$/, "")}/${encodeURIComponent(this.c.bucket)}/${key}`;
  }
  async put(key: string, bytes: Uint8Array, contentType: string) {
    const body = bytes.slice();
    const res = await this.client.fetch(this.url(key), { method: "PUT", body: body.buffer, headers: { "Content-Type": contentType } });
    if (!res.ok) throw new Error(`storage put failed: ${res.status}`);
  }
  async get(key: string) {
    const res = await this.client.fetch(this.url(key));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`storage get failed: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  async remove(key: string) {
    const res = await this.client.fetch(this.url(key), { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new Error(`storage delete failed: ${res.status}`);
  }
  async signedUrl(key: string, filename: string, seconds: number) {
    const url = new URL(this.url(key));
    url.searchParams.set("X-Amz-Expires", String(seconds));
    url.searchParams.set("response-content-disposition", `attachment; filename="${filename.replace(/"/g, "")}"`);
    const signed = await this.client.sign(url.toString(), { method: "GET", aws: { signQuery: true } });
    return signed.url;
  }
}

let override: Storage | null = null;

export function getStorage(): Storage {
  if (override) return override;
  const { storage } = getConfig();
  if (storage.driver === "s3") return new S3Storage(storage);
  if (storage.driver === "netlify-blobs") {
    const siteID = process.env.NETLIFY_BLOBS_SITE_ID;
    const token = process.env.NETLIFY_BLOBS_TOKEN;
    return new NetlifyBlobStorage(storage.store, siteID && token ? { siteID, token, apiURL: process.env.NETLIFY_BLOBS_API_URL } : undefined);
  }
  return new LocalStorage(storage.dir);
}

/** Tests only. */
export function setStorageForTests(s: Storage | null) {
  override = s;
}

export function netlifyBlobStorageForTests(name: string, explicit: { siteID: string; token: string; apiURL: string }) {
  return new NetlifyBlobStorage(name, explicit);
}
