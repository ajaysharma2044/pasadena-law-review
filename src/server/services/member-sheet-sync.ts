import { createSign } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import { getDb, type DB } from "../db/client";
import { memberships, session, user } from "../db/schema";

export const MEMBER_SHEET_HEADERS = ["Member ID", "Name", "Email", "Email verified", "Role", "Status", "Joined (UTC)", "Latest retained sign-in (UTC)"];

/** Explicit allowlist: never select passwords, tokens, IP addresses or user agents. */
export async function memberSheetRows(db: DB = getDb()) {
  const rows = await db.select({
    id: user.id, name: user.name, email: user.email, verified: user.emailVerified,
    role: memberships.role, status: memberships.status, joined: user.createdAt,
    latestSignIn: sql<string | null>`(select max(${session.createdAt}) from ${session} where ${session.userId} = ${user.id})`,
  }).from(user).leftJoin(memberships, eq(memberships.userId, user.id)).orderBy(asc(user.id));
  return rows.map((r) => [r.id, r.name, r.email, r.verified, r.role ?? "member", r.status ?? "active", r.joined.toISOString(), r.latestSignIn ? new Date(r.latestSignIn).toISOString() : ""]);
}

type SyncConfig = { spreadsheetId: string; email: string; privateKey: string };

export function memberSheetConfig(env: Record<string, string | undefined> = process.env): SyncConfig | null {
  const id = env.MEMBER_SHEET_ID;
  const raw = env.MEMBER_SHEET_GOOGLE_CREDENTIALS;
  if (!id && !raw) return null;
  if (!id || !raw || !/^[\w-]+$/.test(id)) throw new Error("Member sheet configuration is incomplete");
  const key = JSON.parse(raw) as Record<string, unknown>;
  if (key.type !== "service_account" || typeof key.client_email !== "string" || typeof key.private_key !== "string") {
    throw new Error("Member sheet requires Google service account credentials");
  }
  return { spreadsheetId: id, email: key.client_email, privateKey: key.private_key };
}

const requestTimeout = () => AbortSignal.timeout(20_000);

async function accessToken(config: SyncConfig) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: config.email, scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(config.privateKey, "base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", signal: requestTimeout(),
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  if (!response.ok) throw new Error(`Google authorization failed (${response.status})`);
  const result = await response.json() as { access_token?: string };
  if (!result.access_token) throw new Error("Google authorization returned no access token");
  return result.access_token;
}

/** Replaces only the dedicated Members tab, atomically with its freshness marker. */
export async function syncMemberSheet(config: SyncConfig, db: DB = getDb()) {
  const values = [MEMBER_SHEET_HEADERS, ...await memberSheetRows(db)];
  const token = await accessToken(config);
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const meta = await fetch(`${base}?fields=sheets.properties`, { headers, signal: requestTimeout() });
  if (!meta.ok) throw new Error(`Cannot read member spreadsheet (${meta.status})`);
  const info = await meta.json() as { sheets: { properties: { sheetId: number; title: string; gridProperties: { rowCount: number } } }[] };
  const members = info.sheets.find((s) => s.properties.title === "Members")?.properties;
  const sync = info.sheets.find((s) => s.properties.title === "Sync")?.properties;
  if (!members || !sync) throw new Error("Spreadsheet needs Members and Sync tabs");
  const rows = (data: unknown[][]) => data.map((cells) => ({ values: cells.map((v) => ({ userEnteredValue: typeof v === "boolean" ? { boolValue: v } : typeof v === "number" ? { numberValue: v } : { stringValue: String(v) } })) }));
  const requests: Record<string, unknown>[] = [];
  if (values.length > members.gridProperties.rowCount) requests.push({ appendDimension: { sheetId: members.sheetId, dimension: "ROWS", length: values.length - members.gridProperties.rowCount } });
  requests.push({ updateCells: { range: { sheetId: members.sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: 8 }, rows: rows(values), fields: "userEnteredValue" } });
  requests.push({ updateCells: { start: { sheetId: sync.sheetId, rowIndex: 0, columnIndex: 0 }, rows: rows([
    ["Status", "Last successful sync (UTC)", "Members", "Sign-in timestamp coverage"],
    ["Connected", new Date().toISOString(), values.length - 1, "Latest session still retained; signed-out/deleted sessions are not a permanent login history."],
  ]), fields: "userEnteredValue" } });
  const response = await fetch(`${base}:batchUpdate`, { method: "POST", headers, signal: requestTimeout(), body: JSON.stringify({ requests }) });
  if (!response.ok) throw new Error(`Member spreadsheet update failed (${response.status})`);
  return { members: values.length - 1 };
}
