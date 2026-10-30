import { and, eq, asc } from "drizzle-orm";
import { assertRole, type Actor } from "../actor";
import { getDb } from "../db/client";
import { audit } from "../audit";
import { authorProfiles, contributorBadges, user } from "../db/schema";
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

export async function setBadge(actor: Actor, userId: string, badgeKey: string, action: string, reason: string) {
 assertRole(actor, ["admin"]);
 if (!Object.prototype.hasOwnProperty.call(BADGES, badgeKey) || !["award","revoke"].includes(action)) throw invalid("Invalid badge or action.");
 const db = getDb();
 await db.transaction(async tx => {
  const [u] = await tx.select({id:user.id}).from(user).where(eq(user.id,userId));
  if (!u) throw notFound();
  if (action === "award") {
   await tx.insert(contributorBadges).values({userId,badgeKey,awardedBy:actor.userId,reason:reason.slice(0,300)}).onConflictDoNothing();
  } else {
   await tx.delete(contributorBadges).where(and(eq(contributorBadges.userId,userId),eq(contributorBadges.badgeKey,badgeKey)));
  }
  await audit(tx,{actorId:actor.userId,action:action==="award"?"badge.award":"badge.revoke",targetType:"user",targetId:userId,metadata:{badgeKey,reason:reason.slice(0,300)}});
 });
}
export async function allAwards(actor: Actor) {
 assertRole(actor,["admin"]);
 return getDb().select({userId:contributorBadges.userId,key:contributorBadges.badgeKey,name:user.name,email:user.email})
  .from(contributorBadges).innerJoin(user,eq(user.id,contributorBadges.userId)).orderBy(asc(user.name));
}
export async function myAwards(userId: string) {
 const rows=await getDb().select({key:contributorBadges.badgeKey}).from(contributorBadges).where(eq(contributorBadges.userId,userId));
 return rows.filter(x=>Object.prototype.hasOwnProperty.call(BADGES,x.key)).map(x=>({key:x.key,title:BADGES[x.key as BadgeKey]}));
}
export async function visibleAwards(userId: string|null) {
 if(!userId) return [];
 const [p]=await getDb().select({showBadges:authorProfiles.showBadges}).from(authorProfiles).where(eq(authorProfiles.userId,userId));
 return p?.showBadges ? myAwards(userId) : [];
}
export async function setVisibility(actor: Actor, showBadges: boolean) {
 const db=getDb();
 await db.insert(authorProfiles).values({userId:actor.userId,displayName:actor.name,showBadges}).onConflictDoUpdate({target:authorProfiles.userId,set:{showBadges,updatedAt:new Date()}});
 await audit(db,{actorId:actor.userId,action:"badge.visibility",targetType:"user",targetId:actor.userId,metadata:{showBadges}});
}
