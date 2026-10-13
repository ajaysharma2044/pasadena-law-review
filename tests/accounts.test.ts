import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as signOutRoute from "@/app/api/session/sign-out/route";
import * as signUpRoute from "@/app/api/session/sign-up/route";
import * as resendRoute from "@/app/api/session/resend-verification/route";
import * as forgotRoute from "@/app/api/session/forgot-password/route";
import * as resetRoute from "@/app/api/session/reset-password/route";
import * as profileRoute from "@/app/api/account/profile/route";
import * as applyRoute from "@/app/api/account/applications/route";
import * as roleRoute from "@/app/api/admin/members/[id]/role/route";
import * as statusRoute from "@/app/api/admin/members/[id]/status/route";
import * as decideRoute from "@/app/api/admin/applications/[id]/decision/route";
import { getActor } from "@/server/actor";
import { loadConfig, setConfigForTests } from "@/server/config";
import { clientIp } from "@/server/ratelimit";
import { getDb } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { bootstrapAdmin } from "@/server/services/members";
import { call, latestLink, setupApp } from "./helpers/app";
import { PASSWORD, makeUser, membershipOf, openVerificationLink, signIn, signUp } from "./helpers/users";

let handle: Awaited<ReturnType<typeof setupApp>>;
beforeEach(async () => {
  handle = await setupApp();
});
afterEach(async () => {
  vi.useRealTimers();
  await handle.close();
});

const userByEmail = async (email: string) => (await getDb().select().from(s.user).where(eq(s.user.email, email)))[0];
const headersWith = (cookie: string) => new Headers({ cookie });

describe("sign-up and verification", () => {
  it("creates an ordinary member; extra fields in the request cannot grant privileges", async () => {
    const res = await signUp("ana@example.org", "Ana", PASSWORD, { role: "admin", status: "active", emailVerified: true });
    expect(res.status).toBe(200);
    const u = await userByEmail("ana@example.org");
    expect(u.emailVerified).toBe(false);
    expect(await membershipOf(u.id)).toMatchObject({ role: "member", status: "active" });
  });

  it("answers the same way for an email that already has an account (no enumeration), without a second account", async () => {
    const first = await signUp("ana@example.org");
    const second = await signUp("ana@example.org");
    expect(second.status).toBe(first.status);
    expect(await second.json()).toEqual(await first.json());
    expect((await getDb().select().from(s.user).where(eq(s.user.email, "ana@example.org"))).length).toBe(1);
  });

  it("refuses sign-in until the email is verified, with no session created", async () => {
    await signUp("ben@example.org");
    const { res, cookie } = await signIn("ben@example.org");
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("email_unverified");
    expect(cookie).toBe("");
  });

  it("confirms the address through the emailed link without signing anyone in", async () => {
    // Opening the link only confirms the address. Otherwise someone who opened another person's link
    // would be signed in to that person's account without noticing.
    await signUp("cy@example.org");
    const live = (r: Response) => r.headers.getSetCookie().some((c) => c.includes("session_token=") && !c.includes("Max-Age=0"));
    const first = await openVerificationLink("cy@example.org");
    expect(live(first)).toBe(false);
    expect(first.headers.get("location")).toContain("/verify-email?confirmed=1");
    const u = await userByEmail("cy@example.org");
    expect(u.emailVerified).toBe(true);
    const replay = await openVerificationLink("cy@example.org");
    expect(live(replay)).toBe(false);
    expect((await getDb().select().from(s.session).where(eq(s.session.userId, u.id))).length).toBe(0);
    expect((await signIn("cy@example.org")).cookie).not.toBe("");
  });

  it("rejects an expired verification link", async () => {
    await signUp("dee@example.org");
    const link = await latestLink("dee@example.org", "verify_email");
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 2 * 60 * 60 * 1000 });
    const authRoute = await import("@/app/api/auth/[...all]/route");
    const res = await call(authRoute, "GET", link, { origin: null });
    expect(res.headers.get("location")).toMatch(/error=TOKEN_EXPIRED/);
    expect((await userByEmail("dee@example.org")).emailVerified).toBe(false);
  });

  it("resends a verification link with a generic answer for any address", async () => {
    await signUp("eve@example.org");
    const known = await call(resendRoute, "POST", "/api/session/resend-verification", { json: { email: "eve@example.org" } });
    const unknown = await call(resendRoute, "POST", "/api/session/resend-verification", { json: { email: "nobody@example.org" } });
    expect(known.status).toBe(200);
    expect(await unknown.json()).toEqual(await known.json());
  });
});

describe("password reset", () => {
  it("resets with a single-use link and signs out every existing session", async () => {
    const u = await makeUser("fay@example.org");
    expect(await getActor(headersWith(u.cookie))).not.toBeNull();

    const req = await call(forgotRoute, "POST", "/api/session/forgot-password", { json: { email: "fay@example.org" } });
    const unknown = await call(forgotRoute, "POST", "/api/session/forgot-password", { json: { email: "ghost@example.org" } });
    expect(await unknown.json()).toEqual(await req.json());

    const link = await latestLink("fay@example.org", "reset_password");
    const authRoute = await import("@/app/api/auth/[...all]/route");
    const opened = await call(authRoute, "GET", link, { origin: null });
    const token = new URL(opened.headers.get("location")!, "http://x").searchParams.get("token")!;
    expect(token).toBeTruthy();

    const done = await call(resetRoute, "POST", "/api/session/reset-password", { json: { token, password: "a brand new passphrase" } });
    expect(done.status).toBe(200);
    expect(await getActor(headersWith(u.cookie))).toBeNull(); // old session revoked
    expect((await signIn("fay@example.org", "a brand new passphrase")).res.status).toBe(200);
    expect((await signIn("fay@example.org", PASSWORD)).res.status).toBe(401);

    const replay = await call(resetRoute, "POST", "/api/session/reset-password", { json: { token, password: "yet another passphrase" } });
    expect(replay.status).toBe(400);
  });

  it("rejects an expired reset token", async () => {
    await makeUser("gus@example.org");
    await call(forgotRoute, "POST", "/api/session/forgot-password", { json: { email: "gus@example.org" } });
    const link = await latestLink("gus@example.org", "reset_password");
    const token = link.split("/reset-password/")[1].split("?")[0];
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 2 * 60 * 60 * 1000 });
    const res = await call(resetRoute, "POST", "/api/session/reset-password", { json: { token, password: "a brand new passphrase" } });
    expect(res.status).toBe(400);
  });
});

describe("authorization boundaries", () => {
  it("denies anonymous requests to private endpoints", async () => {
    const res = await call(applyRoute, "POST", "/api/account/applications", { json: { statement: "I edit." } });
    expect(res.status).toBe(401);
  });

  it("denies cross-site requests even with a valid session", async () => {
    const u = await makeUser("hal@example.org");
    const res = await call(profileRoute, "POST", "/api/account/profile", {
      cookie: u.cookie,
      origin: "https://evil.example",
      json: { displayName: "Hal" },
    });
    expect(res.status).toBe(403);
  });

  it("does not let profile updates change roles or status", async () => {
    const u = await makeUser("ivy@example.org");
    const res = await call(profileRoute, "POST", "/api/account/profile", {
      cookie: u.cookie,
      json: { displayName: "Ivy R.", bio: "Student.", role: "admin", status: "active" },
    });
    expect(res.status).toBe(200);
    expect(await membershipOf(u.id)).toMatchObject({ role: "member" });
  });

  it("denies members (including themselves) the admin endpoints", async () => {
    const u = await makeUser("jo@example.org");
    const res = await call(roleRoute, "POST", `/api/admin/members/${u.id}/role`, { cookie: u.cookie, params: { id: u.id }, json: { role: "admin" } });
    expect(res.status).toBe(403);
    expect(await membershipOf(u.id)).toMatchObject({ role: "member" });
  });

  it("denies editors the admin endpoints", async () => {
    const ed = await makeUser("kai@example.org", "editor");
    const m = await makeUser("lu@example.org");
    const res = await call(statusRoute, "POST", `/api/admin/members/${m.id}/status`, { cookie: ed.cookie, params: { id: m.id }, json: { status: "suspended" } });
    expect(res.status).toBe(403);
  });
});

describe("editorial applications", () => {
  it("approves an application: the applicant becomes an editor, with an audit entry and an email", async () => {
    const admin = await makeUser("admin@example.org", "admin");
    const ap = await makeUser("mo@example.org");
    const created = await call(applyRoute, "POST", "/api/account/applications", { cookie: ap.cookie, json: { statement: "I want to edit notes.", experience: "School paper." } });
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: string };

    const dup = await call(applyRoute, "POST", "/api/account/applications", { cookie: ap.cookie, json: { statement: "Again." } });
    expect(dup.status).toBe(409);

    const res = await call(decideRoute, "POST", `/api/admin/applications/${id}/decision`, { cookie: admin.cookie, params: { id }, json: { decision: "approve", note: "Welcome." } });
    expect(res.status).toBe(200);
    expect(await membershipOf(ap.id)).toMatchObject({ role: "editor" });
    const audits = await getDb().select().from(s.auditEvents).where(eq(s.auditEvents.action, "application.approve"));
    expect(audits).toHaveLength(1);
    const mails = await getDb().select().from(s.emailJobs).where(and(eq(s.emailJobs.toEmail, "mo@example.org"), eq(s.emailJobs.kind, "application_decided")));
    expect(mails).toHaveLength(1);

    const again = await call(decideRoute, "POST", `/api/admin/applications/${id}/decision`, { cookie: admin.cookie, params: { id }, json: { decision: "decline" } });
    expect(again.status).toBe(409);
  });

  it("declines an application: the applicant stays a member", async () => {
    const admin = await makeUser("admin@example.org", "admin");
    const ap = await makeUser("ned@example.org");
    const { id } = (await (await call(applyRoute, "POST", "/api/account/applications", { cookie: ap.cookie, json: { statement: "Please." } })).json()) as { id: string };
    await call(decideRoute, "POST", `/api/admin/applications/${id}/decision`, { cookie: admin.cookie, params: { id }, json: { decision: "decline", note: "Not this term." } });
    expect(await membershipOf(ap.id)).toMatchObject({ role: "member" });
  });
});

describe("suspension, revocation and the last administrator", () => {
  it("suspension ends access on the next request and deletes sessions", async () => {
    const admin = await makeUser("admin@example.org", "admin");
    const m = await makeUser("ola@example.org");
    expect(await getActor(headersWith(m.cookie))).not.toBeNull();
    const res = await call(statusRoute, "POST", `/api/admin/members/${m.id}/status`, { cookie: admin.cookie, params: { id: m.id }, json: { status: "suspended", reason: "Spam." } });
    expect(res.status).toBe(200);
    expect(await getActor(headersWith(m.cookie))).toBeNull();
    const again = await signIn("ola@example.org");
    const blocked = await call(profileRoute, "POST", "/api/account/profile", { cookie: again.cookie, json: { displayName: "Ola" } });
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).error).toBe("suspended");
  });

  it("a revoked editor loses editor access on the next request", async () => {
    const admin = await makeUser("admin@example.org", "admin");
    const ed = await makeUser("pat@example.org", "editor");
    expect((await getActor(headersWith(ed.cookie)))!.role).toBe("editor");
    await call(roleRoute, "POST", `/api/admin/members/${ed.id}/role`, { cookie: admin.cookie, params: { id: ed.id }, json: { role: "member" } });
    expect((await getActor(headersWith(ed.cookie)))!.role).toBe("member");
  });

  it("refuses to demote or suspend the last active administrator", async () => {
    const admin = await makeUser("admin@example.org", "admin");
    const demote = await call(roleRoute, "POST", `/api/admin/members/${admin.id}/role`, { cookie: admin.cookie, params: { id: admin.id }, json: { role: "member" } });
    expect(demote.status).toBe(409);
    const suspend = await call(statusRoute, "POST", `/api/admin/members/${admin.id}/status`, { cookie: admin.cookie, params: { id: admin.id }, json: { status: "suspended" } });
    expect(suspend.status).toBe(409);
    const second = await makeUser("admin2@example.org", "admin");
    const ok = await call(roleRoute, "POST", `/api/admin/members/${second.id}/role`, { cookie: admin.cookie, params: { id: second.id }, json: { role: "editor" } });
    expect(ok.status).toBe(200);
  });

  it("bootstraps the first administrator only when none exists, and only for a verified account", async () => {
    await signUp("quinn@example.org");
    await expect(bootstrapAdmin(getDb(), "quinn@example.org")).rejects.toThrow(/verified/);
    await openVerificationLink("quinn@example.org");
    await bootstrapAdmin(getDb(), "quinn@example.org");
    const q = await userByEmail("quinn@example.org");
    expect(await membershipOf(q.id)).toMatchObject({ role: "admin" });
    await makeUser("rae@example.org");
    await expect(bootstrapAdmin(getDb(), "rae@example.org")).rejects.toThrow(/already/);
  });
});

describe("session handling and rate limits", () => {
  it("signs out and the old cookie no longer works", async () => {
    const u = await makeUser("sam@example.org");
    const res = await call(signOutRoute, "POST", "/api/session/sign-out", { cookie: u.cookie, json: {} });
    expect(res.status).toBe(200);
    expect(await getActor(headersWith(u.cookie))).toBeNull();
  });

  it("rate-limits repeated sign-in attempts for one address", async () => {
    await handle.close();
    handle = await setupApp({ RATE_LIMITS: "on" });
    await makeUser("tia@example.org");
    let last = 0;
    for (let i = 0; i < 9; i++) last = (await signIn("tia@example.org", "wrong password!")).res.status;
    expect(last).toBe(429);
  });

  it("limits sign-ups per address, and made-up forwarding headers don't reset the per-IP limit", async () => {
    await handle.close();
    handle = await setupApp({ RATE_LIMITS: "on" });
    for (let i = 0; i < 3; i++) expect((await signUp("una@example.org")).status).toBe(200);
    expect((await signUp("una@example.org")).status).toBe(429);
    let last = 0;
    for (let i = 0; i < 8; i++) {
      const res = await call(signUpRoute, "POST", "/api/session/sign-up", {
        json: { name: `V${i}`, email: `v${i}@example.org`, password: PASSWORD },
        headers: { "x-forwarded-for": `198.51.100.${i}`, "x-real-ip": `203.0.113.${i}` },
      });
      last = res.status;
    }
    expect(last).toBe(429);
  });

  it("reads the client address only from the configured proxy header", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "198.51.100.1", "x-real-ip": "198.51.100.2" }))).toBe("unknown");
    expect(clientIp(new Headers({ "x-nf-client-connection-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    setConfigForTests(loadConfig({ NODE_ENV: "test", TRUSTED_IP_HEADER: "x-forwarded-for" }));
    // With a forwarding chain, only the last hop was added by our own proxy.
    expect(clientIp(new Headers({ "x-forwarded-for": "198.51.100.1, 203.0.113.7" }))).toBe("203.0.113.7");
    expect(() => loadConfig({ NODE_ENV: "test", TRUSTED_IP_HEADER: "Not A Header!" })).toThrow();
  });
});
