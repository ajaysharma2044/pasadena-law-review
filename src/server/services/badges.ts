import { and, eq, asc } from "drizzle-orm";
import { assertActive, assertRole, type Actor } from "../actor";
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

export const BADGE_CRITERIA: Record<BadgeKey, string> = {
 published_author: "For an author whose work has completed editorial review and been published in the journal.",
 senior_contributor: "For a sustained record of substantive writing, editing, or service documented by the administrators; no automatic article or attendance threshold.",
 editorial_board: "Recognizes an already authorized editorial appointment. Administrators must confirm the appointment and record its evidence; this badge never appoints anyone or grants elected office.",
 featured_scholar: "For a contribution selected by the editors for exceptional research, sourcing, or analysis. This is journal recognition, not a PCC academic credential.",
 founding_contributor: "For documented contributions to the journal's founding or initial development; this does not confer founder ownership or elected office.",
};

export async function setBadge(actor: Actor, userId: string, badgeKey: string, action: string, reason: string, appointmentConfirmed = false) {
 assertRole(actor, ["admin"]);
 if (!Object.prototype.hasOwnProperty.call(BADGES, badgeKey) || !["award","revoke"].includes(action)) throw invalid("Invalid badge or action.");
 const evidence = reason.trim();
 if (!evidence || evidence.length > 300) throw invalid("Record evidence or a reason (up to 300 characters).");
 if (action === "award" && badgeKey === "editorial_board" && !appointmentConfirmed) throw invalid("Confirm an existing authorized editorial appointment; this badge cannot make an appointment.");
 const db = getDb();
 return db.transaction(async tx => {
  const [u] = await tx.select({id:user.id}).from(user).where(eq(user.id,userId));
  if (!u) throw notFound();
  if (action === "award") {
   const changed = await tx.insert(contributorBadges).values({userId,badgeKey,awardedBy:actor.userId,reason:evidence}).onConflictDoNothing().returning({ userId: contributorBadges.userId });
   if (!changed.length) return false;
  } else {
   const changed = await tx.delete(contributorBadges).where(and(eq(contributorBadges.userId,userId),eq(contributorBadges.badgeKey,badgeKey))).returning({ userId: contributorBadges.userId });
   if (!changed.length) return false;
  }
  await audit(tx,{actorId:actor.userId,action:action==="award"?"badge.award":"badge.revoke",targetType:"user",targetId:userId,metadata:{badgeKey,reason:evidence,...(action === "award" && badgeKey === "editorial_board" ? {appointmentConfirmed:true} : {})}});
  return true;
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
 assertActive(actor);
 const db=getDb();
 await db.transaction(async db => {
 await db.insert(authorProfiles).values({userId:actor.userId,displayName:actor.name,showBadges}).onConflictDoUpdate({target:authorProfiles.userId,set:{showBadges,updatedAt:new Date()}});
 await audit(db,{actorId:actor.userId,action:"badge.visibility",targetType:"user",targetId:actor.userId,metadata:{showBadges}});
 });
}
