import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as route from "@/app/api/jobs/member-sheet-sync/route";
import { MEMBER_SHEET_HEADERS, memberSheetConfig, memberSheetRows, syncMemberSheet } from "@/server/services/member-sheet-sync";
import { call, setupApp } from "./helpers/app";
import { makeUser } from "./helpers/users";

let handle: Awaited<ReturnType<typeof setupApp>>;
beforeEach(async () => { handle = await setupApp({ CRON_SECRET: "s".repeat(32) }); });
afterEach(async () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); await handle.close(); });

describe("member sheet export", () => {
  it("exports a bounded allowlist without credentials or session secrets", async () => {
    await makeUser("member@example.org");
    const rows = await memberSheetRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(MEMBER_SHEET_HEADERS.length);
    expect(rows[0].slice(2, 6)).toEqual(["member@example.org", true, "member", "active"]);
    expect(JSON.stringify(rows)).not.toMatch(/password|token|ip_address|user_agent/i);
  });

  it("requires scheduler authentication before checking Google configuration", async () => {
    expect((await call(route, "POST", "/api/jobs/member-sheet-sync", { origin: null })).status).toBe(401);
    expect((await call(route, "POST", "/api/jobs/member-sheet-sync", { origin: null, headers: { authorization: "Bearer é" } })).status).toBe(401);
    vi.stubEnv("MEMBER_SHEET_ID", ""); vi.stubEnv("MEMBER_SHEET_GOOGLE_CREDENTIALS", "");
    expect(await (await call(route, "POST", "/api/jobs/member-sheet-sync", { origin: null, headers: { authorization: `Bearer ${"s".repeat(32)}` } })).json()).toEqual({ status: "not_configured" });
  });

  it("rejects incomplete service-account setup", () => {
    expect(memberSheetConfig({})).toBeNull();
    expect(() => memberSheetConfig({ MEMBER_SHEET_ID: "sheet" })).toThrow();
    expect(() => memberSheetConfig({ MEMBER_SHEET_ID: "sheet", MEMBER_SHEET_GOOGLE_CREDENTIALS: "{}" })).toThrow();
  });

  it("writes literal strings and removes stale rows in the same batch as the freshness marker", async () => {
    await makeUser("member@example.org");
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: "test-google-token" }))
      .mockResolvedValueOnce(Response.json({ sheets: [
        { properties: { sheetId: 1, title: "Members", gridProperties: { rowCount: 100 } } },
        { properties: { sheetId: 2, title: "Sync", gridProperties: { rowCount: 100 } } },
      ] }))
      .mockResolvedValueOnce(Response.json({ replies: [] }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await syncMemberSheet({ spreadsheetId: "test-sheet", email: "sync@example.iam.gserviceaccount.com", privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString() })).toEqual({ members: 1 });
    const payload = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(payload.requests).toHaveLength(2);
    const update = payload.requests[0].updateCells;
    expect(update.range).toEqual({ sheetId: 1, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: 8 });
    expect(update.fields).toBe("userEnteredValue");
    expect(JSON.stringify(payload)).not.toContain("formulaValue");
    expect(JSON.stringify(payload)).not.toContain("test-google-token");
    expect(payload.requests[1].updateCells.rows[1].values[0]).toEqual({ userEnteredValue: { stringValue: "Connected" } });
  });
});
