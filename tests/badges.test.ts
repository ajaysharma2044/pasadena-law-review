import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import { auditEvents, authorProfiles, contributorBadges, memberships } from "@/server/db/schema";
import { awardableKeys, myAwards, setBadge, setVisibility, visibleAwards } from "@/server/services/badges";
import { actor } from "./helpers/actors";
import { setupApp } from "./helpers/app";

let handle: Awaited<ReturnType<typeof setupApp>>;
beforeEach(async () => { handle = await setupApp(); });
afterEach(() => handle.close());

it("awards and revokes the four awardable badges against the actual migrated schema", async () => {
  const admin = await actor("admin");
  const member = await actor();
  for (const key of awardableKeys) {
    await setBadge(admin, member.userId, key, "award", "Dedicated synthetic test.");
  }
  expect(await myAwards(member.userId)).toHaveLength(4);
  expect(await visibleAwards(member.userId)).toEqual([]);
  await setVisibility(member, true);
  expect(await visibleAwards(member.userId)).toHaveLength(4);
  await setVisibility(member, false);
  expect(await visibleAwards(member.userId)).toEqual([]);
  for (const key of awardableKeys) await setBadge(admin, member.userId, key, "revoke", "Test cleanup");
  expect(await myAwards(member.userId)).toEqual([]);
  const events = await getDb().select().from(auditEvents).where(eq(auditEvents.targetId, member.userId));
  expect(events.filter((e) => e.action === "badge.award")).toHaveLength(4);
  expect(events.filter((e) => e.action === "badge.revoke")).toHaveLength(4);
  const [membership] = await getDb().select().from(memberships).where(eq(memberships.userId, member.userId));
  expect(membership.role).toBe("member");
  expect(membership.status).toBe("active");
});

it("keeps duplicate awards and no-op revocations out of the audit history", async () => {
  const admin = await actor("admin"), member = await actor();
  await setBadge(admin, member.userId, "published_author", "award", "Verified publication");
  await setBadge(admin, member.userId, "published_author", "award", "Duplicate request");
  await setBadge(admin, member.userId, "featured_scholar", "revoke", "Never awarded");
  const awards = await getDb().select().from(contributorBadges);
  expect(awards).toHaveLength(1);
  expect(awards[0].awardedAt).toBeInstanceOf(Date);
  const events = await getDb().select().from(auditEvents).where(eq(auditEvents.targetId, member.userId));
  expect(events.filter((e) => e.action.startsWith("badge."))).toHaveLength(1);
});

it("enforces administrator, account status and valid badge, and keeps Editorial Board out of manual awards", async () => {
  const admin = await actor("admin"), member = await actor(), editor = await actor("editorial_board");
  for (const caller of [member, editor, { ...admin, status: "suspended" as const }, { ...admin, emailVerified: false }]) {
    await expect(setBadge(caller, member.userId, "published_author", "award", "Test")).rejects.toMatchObject({ status: 403 });
  }
  await expect(setBadge(admin, member.userId, "__proto__", "award", "Test")).rejects.toMatchObject({ status: 422 });
  await expect(setBadge(admin, "missing", "published_author", "award", "Test")).rejects.toMatchObject({ status: 404 });
  await expect(setBadge(admin, member.userId, "editorial_board", "award", "Appointed")).rejects.toMatchObject({ status: 422 });
  await expect(setBadge(admin, member.userId, "editorial_board", "revoke", "Removed")).rejects.toMatchObject({ status: 422 });
  await expect(setBadge(admin, member.userId, "published_author", "award", "")).rejects.toMatchObject({ status: 422 });
  await expect(setVisibility({ ...member, status: "suspended" }, true)).rejects.toMatchObject({ status: 403 });
  const [profile] = await getDb().select().from(authorProfiles).where(eq(authorProfiles.userId, member.userId));
  expect(profile.showBadges).toBe(false);
});

it("gives every active editorial board member the Editorial Board badge, from the role alone", async () => {
  const board = await actor("editorial_board");
  const member = await actor();
  expect(await myAwards(board.userId)).toEqual([{ key: "editorial_board", title: "Editorial Board" }]);
  expect(await myAwards(member.userId)).toEqual([]);
  // The badge shows publicly only with the member's opt-in, like any other.
  expect(await visibleAwards(board.userId)).toEqual([]);
  await setVisibility(board, true);
  expect((await visibleAwards(board.userId)).map((a) => a.key)).toEqual(["editorial_board"]);
  // Leaving the board removes it; nothing is left behind in the awards table.
  await getDb().update(memberships).set({ role: "member" }).where(eq(memberships.userId, board.userId));
  expect(await myAwards(board.userId)).toEqual([]);
  expect(await getDb().select().from(contributorBadges)).toHaveLength(0);
});
