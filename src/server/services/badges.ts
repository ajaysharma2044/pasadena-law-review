import { and, asc, eq } from "drizzle-orm";
import { assertActive, assertRole, type Actor } from "../actor";
import { audit } from "../audit";
import { getDb } from "../db/client";
import { authorProfiles, contributorBadges, memberships, user } from "../db/schema";
import { invalid, notFound } from "../errors";

export const BADGES = {
  published_author: "Published Author",
  senior_contributor: "Senior Contributor",
  editorial_board: "Editorial Board",
  featured_scholar: "Featured Scholar",
  founding_contributor: "Founding Contributor",
} as const;
export type BadgeKey = keyof typeof BADGES;
export const keys = Object.keys(BADGES) as BadgeKey[];

/**
 * Editorial Board isn't awarded: it comes with the editorial board role, and goes when the role does.
 * Administrators change it under Members, not here.
 */
export const ROLE_BADGE: BadgeKey = "editorial_board";
export const awardableKeys: BadgeKey[] = keys.filter((k) => k !== ROLE_BADGE);

export const BADGE_CRITERIA: Record<BadgeKey, string> = {
  published_author: "For an author whose work has completed editorial review and been published in the journal.",
  senior_contributor:
    "For a sustained record of substantive writing, editing, or service documented by the administrators; no automatic article or attendance threshold.",
  editorial_board:
    "Held by every member of the editorial board. It comes with the position itself and can't be awarded or revoked separately; an administrator appoints board members under Members. It is not an elected office.",
  featured_scholar:
    "For a contribution selected by the editors for exceptional research, sourcing, or analysis. This is journal recognition, not a PCC academic credential.",
  founding_contributor:
    "For documented contributions to the journal's founding or initial development; this does not confer founder ownership or elected office.",
};

export async function setBadge(actor: Actor, userId: string, badgeKey: string, action: string, reason: string) {
  assertRole(actor, ["admin"]);
  if (badgeKey === ROLE_BADGE) {
    throw invalid("Editorial Board recognition comes with the editorial board role. Change the member's role under Members instead.", { badgeKey: "role_badge" });
  }
  if (!awardableKeys.includes(badgeKey as BadgeKey) || !["award", "revoke"].includes(action)) throw invalid("Invalid badge or action.");
  const evidence = reason.trim();
  if (!evidence || evidence.length > 300) throw invalid("Record evidence or a reason (up to 300 characters).");
  const db = getDb();
  return db.transaction(async (tx) => {
    const [u] = await tx.select({ id: user.id }).from(user).where(eq(user.id, userId));
    if (!u) throw notFound();
    if (action === "award") {
      const changed = await tx
        .insert(contributorBadges)
        .values({ userId, badgeKey, awardedBy: actor.userId, reason: evidence })
        .onConflictDoNothing()
        .returning({ userId: contributorBadges.userId });
      if (!changed.length) return false;
    } else {
      const changed = await tx
        .delete(contributorBadges)
        .where(and(eq(contributorBadges.userId, userId), eq(contributorBadges.badgeKey, badgeKey)))
        .returning({ userId: contributorBadges.userId });
      if (!changed.length) return false;
    }
    await audit(tx, {
      actorId: actor.userId,
      action: action === "award" ? "badge.award" : "badge.revoke",
      targetType: "user",
      targetId: userId,
      metadata: { badgeKey, reason: evidence },
    });
    return true;
  });
}

/** Every award on record, plus the Editorial Board standing of each current board member. */
export async function allAwards(actor: Actor) {
  assertRole(actor, ["admin"]);
  const db = getDb();
  const awarded = await db
    .select({ userId: contributorBadges.userId, key: contributorBadges.badgeKey, name: user.name, email: user.email })
    .from(contributorBadges)
    .innerJoin(user, eq(user.id, contributorBadges.userId))
    .orderBy(asc(user.name));
  const board = await db
    .select({ userId: memberships.userId, name: user.name, email: user.email })
    .from(memberships)
    .innerJoin(user, eq(user.id, memberships.userId))
    .where(and(eq(memberships.role, "editorial_board"), eq(memberships.status, "active")))
    .orderBy(asc(user.name));
  return [...awarded, ...board.map((b) => ({ ...b, key: ROLE_BADGE as string }))];
}

export async function myAwards(userId: string) {
  const db = getDb();
  const [m] = await db.select({ role: memberships.role, status: memberships.status }).from(memberships).where(eq(memberships.userId, userId));
  const rows = await db.select({ key: contributorBadges.badgeKey }).from(contributorBadges).where(eq(contributorBadges.userId, userId));
  const out = rows
    .filter((x) => awardableKeys.includes(x.key as BadgeKey))
    .map((x) => ({ key: x.key, title: BADGES[x.key as BadgeKey] }));
  if (m?.role === "editorial_board" && m.status === "active") out.unshift({ key: ROLE_BADGE, title: BADGES[ROLE_BADGE] });
  return out;
}

export async function visibleAwards(userId: string | null) {
  if (!userId) return [];
  const [p] = await getDb().select({ showBadges: authorProfiles.showBadges }).from(authorProfiles).where(eq(authorProfiles.userId, userId));
  return p?.showBadges ? myAwards(userId) : [];
}

export async function setVisibility(actor: Actor, showBadges: boolean) {
  assertActive(actor);
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .insert(authorProfiles)
      .values({ userId: actor.userId, displayName: actor.name, showBadges })
      .onConflictDoUpdate({ target: authorProfiles.userId, set: { showBadges, updatedAt: new Date() } });
    await audit(tx, { actorId: actor.userId, action: "badge.visibility", targetType: "user", targetId: actor.userId, metadata: { showBadges } });
  });
}
