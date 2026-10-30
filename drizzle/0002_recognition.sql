ALTER TABLE "author_profiles" ADD COLUMN "show_badges" boolean DEFAULT false NOT NULL;
CREATE TABLE "contributor_badges" (
 "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
 "badge_key" text NOT NULL,
 "awarded_by" text REFERENCES "user"("id") ON DELETE SET NULL,
 "reason" text DEFAULT '' NOT NULL,
 "awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "contributor_badge_valid" CHECK ("badge_key" IN ('published_author','senior_contributor','editorial_board','featured_scholar','founding_contributor'))
);
CREATE UNIQUE INDEX "contributor_badge_unique" ON "contributor_badges" ("user_id","badge_key");
