import { eq } from "drizzle-orm";
import type { Actor } from "../actor";
import { audit } from "../audit";
import { getDb } from "../db/client";
import { authorProfiles } from "../db/schema";
import { invalid } from "../errors";

/** Public byline and bio. Separate from private account fields; never touches roles or status. */
export async function updateProfile(actor: Actor, displayName: string, bio: string) {
  const name = displayName.trim();
  if (!name) throw invalid("Your public name is required.", { displayName: "required" });
  if (name.length > 120) throw invalid("Your public name is too long.", { displayName: "too_long" });
  const db = getDb();
  await db
    .insert(authorProfiles)
    .values({ userId: actor.userId, displayName: name, bio: bio.trim().slice(0, 1200) })
    .onConflictDoUpdate({ target: authorProfiles.userId, set: { displayName: name, bio: bio.trim().slice(0, 1200), updatedAt: new Date() } });
  await audit(db, { actorId: actor.userId, action: "profile.update", targetType: "user", targetId: actor.userId });
}

export async function getProfile(userId: string) {
  const [p] = await getDb().select().from(authorProfiles).where(eq(authorProfiles.userId, userId));
  return p ?? null;
}
