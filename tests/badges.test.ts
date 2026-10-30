import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as badgesRoute from "@/app/api/admin/badges/route";
import * as visibilityRoute from "@/app/api/account/badge-visibility/route";
import { getDb } from "@/server/db/client";
import { contributorBadges, auditEvents, authorProfiles } from "@/server/db/schema";
import { call, setupApp } from "./helpers/app";
import { makeUser } from "./helpers/users";

let handle: Awaited<ReturnType<typeof setupApp>>;
beforeEach(async () => { handle = await setupApp(); });
afterEach(async () => { await handle.close(); });

describe("contributor badge endpoints", () => {
  it("awards, deduplicates and revokes in a transaction with audit history", async () => {
    const admin = await makeUser("badge-admin@example.org", "admin");
    const member = await makeUser("badge-member@example.org");
    const data = { userId: member.id, badgeKey: "published_author", action: "award", reason: "verified article" };
    const first = await call(badgesRoute, "POST", "/api/admin/badges", { cookie: admin.cookie, json: data });
    expect(first.status).toBe(200);
    const duplicate = await call(badgesRoute, "POST", "/api/admin/badges", { cookie: admin.cookie, json: data });
    expect(duplicate.status).toBe(200);
    expect((await getDb().select().from(contributorBadges).where(eq(contributorBadges.userId, member.id))).length).toBe(1);
    const denied = await call(badgesRoute, "POST", "/api/admin/badges", { cookie: member.cookie, json: data });
    expect(denied.status).toBe(403);
    const revoked = await call(badgesRoute, "POST", "/api/admin/badges", { cookie: admin.cookie, json: {...data, action: "revoke"} });
    expect(revoked.status).toBe(200);
    expect((await getDb().select().from(contributorBadges).where(eq(contributorBadges.userId, member.id))).length).toBe(0);
    expect((await getDb().select().from(auditEvents)).filter(x=>x.action.startsWith("badge.")).length).toBe(3);
  });

  it("keeps awards private until explicit member opt-in", async () => {
    const member = await makeUser("badge-privacy@example.org");
    const res=await call(visibilityRoute,"POST","/api/account/badge-visibility",{cookie:member.cookie,json:{showBadges:"on"}});
    expect(res.status).toBe(200);
    const [p]=await getDb().select().from(authorProfiles).where(eq(authorProfiles.userId,member.id));
    expect(p.showBadges).toBe(true);
  });
});
