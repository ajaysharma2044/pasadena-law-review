-- The "editor" role becomes "editorial board": the same editing powers, under the name the Journal uses.
-- Written to be safe on a database that already ran an earlier copy of this change.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'member_role' AND e.enumlabel = 'editor'
  ) THEN
    ALTER TYPE "public"."member_role" RENAME VALUE 'editor' TO 'editorial_board';
  END IF;
END $$;
--> statement-breakpoint
-- Editorial Board recognition now comes with the role itself, so it is no longer an award an
-- administrator hands out. Any earlier manual awards are removed; the role is the record.
DELETE FROM "contributor_badges" WHERE "badge_key" = 'editorial_board';
--> statement-breakpoint
ALTER TABLE "contributor_badges" DROP CONSTRAINT IF EXISTS "contributor_badge_valid";
--> statement-breakpoint
ALTER TABLE "contributor_badges" ADD CONSTRAINT "contributor_badge_valid" CHECK ("badge_key" IN ('published_author','senior_contributor','featured_scholar','founding_contributor'));
