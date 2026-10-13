CREATE TYPE "public"."application_status" AS ENUM('pending', 'approved', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."editorial_decision" AS ENUM('accept', 'request_changes', 'decline', 'reopen');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('queued', 'sending', 'accepted', 'delivered', 'bounced', 'complained', 'failed');--> statement-breakpoint
CREATE TYPE "public"."manuscript_status" AS ENUM('draft', 'submitted', 'in_review', 'changes_requested', 'resubmitted', 'accepted', 'published', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('draft', 'announced', 'held', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('pending', 'active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."page_version_status" AS ENUM('draft', 'proposed', 'published', 'superseded', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."piece_kind" AS ENUM('essay', 'proposal', 'note', 'forum');--> statement-breakpoint
CREATE TYPE "public"."publication_state" AS ENUM('live', 'unpublished');--> statement-breakpoint
CREATE TYPE "public"."recommendation" AS ENUM('accept', 'changes', 'decline');--> statement-breakpoint
CREATE TYPE "public"."revision_source" AS ENUM('author_submission', 'editor_edit', 'migration');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('member', 'editor', 'admin');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manuscript_id" uuid NOT NULL,
	"uploader_id" text,
	"storage_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attachments_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "author_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manuscript_id" uuid NOT NULL,
	"revision_id" uuid,
	"body" text NOT NULL,
	"created_by" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "author_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_page_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_key" text NOT NULL,
	"body_md" text NOT NULL,
	"status" "page_version_status" DEFAULT 'draft' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_by" text,
	"decided_by" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "editorial_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"statement" text NOT NULL,
	"experience" text DEFAULT '' NOT NULL,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"decision_note" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editorial_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manuscript_id" uuid NOT NULL,
	"revision_id" uuid,
	"decision" "editorial_decision" NOT NULL,
	"author_note" text DEFAULT '' NOT NULL,
	"decided_by" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"provider_event_id" text,
	"type" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_events_provider_event_id_unique" UNIQUE("provider_event_id")
);
--> statement-breakpoint
CREATE TABLE "email_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"to_email" text NOT NULL,
	"to_user_id" text,
	"subject" text NOT NULL,
	"text_body" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "email_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"provider_message_id" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_jobs_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "email_jobs_provider_message_id_unique" UNIQUE("provider_message_id")
);
--> statement-breakpoint
CREATE TABLE "internal_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manuscript_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_by" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"volume_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"term_label" text NOT NULL,
	"visible" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manuscript_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manuscript_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"source" "revision_source" NOT NULL,
	"kind" "piece_kind" NOT NULL,
	"title" text NOT NULL,
	"deck" text NOT NULL,
	"abstract" text NOT NULL,
	"body_md" text NOT NULL,
	"author_bio" text NOT NULL,
	"disclosure" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_by" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manuscripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" text,
	"attribution_note" text,
	"kind" "piece_kind" NOT NULL,
	"status" "manuscript_status" DEFAULT 'draft' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"deck" text DEFAULT '' NOT NULL,
	"abstract" text DEFAULT '' NOT NULL,
	"body_md" text DEFAULT '' NOT NULL,
	"author_bio" text DEFAULT '' NOT NULL,
	"disclosure" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"current_revision_id" uuid,
	"submitted_at" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "migrated_or_owned" CHECK ("manuscripts"."author_id" is not null or "manuscripts"."attribution_note" is not null)
);
--> statement-breakpoint
CREATE TABLE "masthead_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_title" text NOT NULL,
	"person_name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "meeting_status" DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone,
	"timezone" text DEFAULT 'America/Los_Angeles' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"motion" text DEFAULT '' NOT NULL,
	"opener_for" text DEFAULT '' NOT NULL,
	"opener_against" text DEFAULT '' NOT NULL,
	"attendance_policy" text DEFAULT '' NOT NULL,
	"minutes_md" text DEFAULT '' NOT NULL,
	"minutes_published" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announced_has_time" CHECK ("meetings"."status" = 'draft' or "meetings"."starts_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"status_reason" text,
	"updated_by" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publication_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manuscript_id" uuid NOT NULL,
	"label" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publication_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"title" text NOT NULL,
	"deck" text NOT NULL,
	"abstract" text NOT NULL,
	"byline" text NOT NULL,
	"author_bio" text NOT NULL,
	"body_html" text NOT NULL,
	"published_by" text,
	"publishedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manuscript_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"kind" "piece_kind" NOT NULL,
	"issue_id" uuid,
	"issue_order" integer DEFAULT 0 NOT NULL,
	"state" "publication_state" DEFAULT 'live' NOT NULL,
	"current_version_id" uuid,
	"first_published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publications_manuscript_id_unique" UNIQUE("manuscript_id"),
	CONSTRAINT "publications_slug_unique" UNIQUE("slug"),
	CONSTRAINT "slug_format" CHECK ("publications"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "review_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manuscript_id" uuid NOT NULL,
	"editor_id" text NOT NULL,
	"assigned_by" text,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "review_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manuscript_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"editor_id" text NOT NULL,
	"recommendation" "recommendation" NOT NULL,
	"rationale" text DEFAULT '' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "volumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer NOT NULL,
	"label" text NOT NULL,
	"year_label" text DEFAULT '' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "volumes_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploader_id_user_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_feedback" ADD CONSTRAINT "author_feedback_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_feedback" ADD CONSTRAINT "author_feedback_revision_id_manuscript_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."manuscript_revisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_feedback" ADD CONSTRAINT "author_feedback_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_profiles" ADD CONSTRAINT "author_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_page_versions" ADD CONSTRAINT "cms_page_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cms_page_versions" ADD CONSTRAINT "cms_page_versions_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_applications" ADD CONSTRAINT "editorial_applications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_applications" ADD CONSTRAINT "editorial_applications_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_decisions" ADD CONSTRAINT "editorial_decisions_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_decisions" ADD CONSTRAINT "editorial_decisions_revision_id_manuscript_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."manuscript_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_decisions" ADD CONSTRAINT "editorial_decisions_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_job_id_email_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."email_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_jobs" ADD CONSTRAINT "email_jobs_to_user_id_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_volume_id_volumes_id_fk" FOREIGN KEY ("volume_id") REFERENCES "public"."volumes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuscript_revisions" ADD CONSTRAINT "manuscript_revisions_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuscript_revisions" ADD CONSTRAINT "manuscript_revisions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manuscripts" ADD CONSTRAINT "manuscripts_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_checks" ADD CONSTRAINT "publication_checks_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_checks" ADD CONSTRAINT "publication_checks_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_versions" ADD CONSTRAINT "publication_versions_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_versions" ADD CONSTRAINT "publication_versions_revision_id_manuscript_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."manuscript_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_versions" ADD CONSTRAINT "publication_versions_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_editor_id_user_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_recommendations" ADD CONSTRAINT "review_recommendations_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_recommendations" ADD CONSTRAINT "review_recommendations_revision_id_manuscript_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."manuscript_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_recommendations" ADD CONSTRAINT "review_recommendations_editor_id_user_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "attachments_manuscript_idx" ON "attachments" USING btree ("manuscript_id");--> statement-breakpoint
CREATE INDEX "audit_target_idx" ON "audit_events" USING btree ("target_type","target_id","createdAt");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_events" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "feedback_manuscript_idx" ON "author_feedback" USING btree ("manuscript_id","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "one_published_page_version" ON "cms_page_versions" USING btree ("page_key") WHERE "cms_page_versions"."status" = 'published';--> statement-breakpoint
CREATE INDEX "page_versions_key_idx" ON "cms_page_versions" USING btree ("page_key","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "one_pending_application_per_user" ON "editorial_applications" USING btree ("user_id") WHERE "editorial_applications"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "applications_status_idx" ON "editorial_applications" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX "decisions_manuscript_idx" ON "editorial_decisions" USING btree ("manuscript_id","createdAt");--> statement-breakpoint
CREATE INDEX "email_events_job_idx" ON "email_events" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "email_jobs_due_idx" ON "email_jobs" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notes_manuscript_idx" ON "internal_notes" USING btree ("manuscript_id","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_number_unique" ON "issues" USING btree ("volume_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "revision_seq_unique" ON "manuscript_revisions" USING btree ("manuscript_id","seq");--> statement-breakpoint
CREATE INDEX "manuscripts_author_idx" ON "manuscripts" USING btree ("author_id","updatedAt");--> statement-breakpoint
CREATE INDEX "manuscripts_status_idx" ON "manuscripts" USING btree ("status","updatedAt");--> statement-breakpoint
CREATE INDEX "meetings_status_idx" ON "meetings" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "checks_manuscript_idx" ON "publication_checks" USING btree ("manuscript_id");--> statement-breakpoint
CREATE INDEX "versions_publication_idx" ON "publication_versions" USING btree ("publication_id","publishedAt");--> statement-breakpoint
CREATE INDEX "publications_state_idx" ON "publications" USING btree ("state","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_assignment" ON "review_assignments" USING btree ("manuscript_id","editor_id") WHERE "review_assignments"."active";--> statement-breakpoint
CREATE INDEX "assignments_editor_idx" ON "review_assignments" USING btree ("editor_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "one_recommendation_per_editor_revision" ON "review_recommendations" USING btree ("revision_id","editor_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");