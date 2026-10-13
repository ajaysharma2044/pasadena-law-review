import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const now = () => timestamp({ withTimezone: true }).notNull().defaultNow();

// Better Auth core tables. Property names are what the adapter expects;
// column names are snake_case.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: now(),
  updatedAt: now(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: now(),
    updatedAt: now(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: now(),
    updatedAt: now(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: now(),
    updatedAt: now(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// Application tables

export const roleEnum = pgEnum("member_role", ["member", "editor", "admin"]);
export const memberStatusEnum = pgEnum("member_status", ["pending", "active", "suspended"]);

export const memberships = pgTable("memberships", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull().default("member"),
  status: memberStatusEnum("status").notNull().default("active"),
  statusReason: text("status_reason"),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: now(),
  updatedAt: now(),
});

export const authorProfiles = pgTable("author_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  bio: text("bio").notNull().default(""),
  updatedAt: now(),
});

export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "approved",
  "declined",
  "withdrawn",
]);

export const editorialApplications = pgTable(
  "editorial_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    statement: text("statement").notNull(),
    experience: text("experience").notNull().default(""),
    status: applicationStatusEnum("status").notNull().default("pending"),
    decisionNote: text("decision_note"),
    decidedBy: text("decided_by").references(() => user.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: now(),
  },
  (t) => [
    uniqueIndex("one_pending_application_per_user")
      .on(t.userId)
      .where(sql`${t.status} = 'pending'`),
    index("applications_status_idx").on(t.status, t.createdAt),
  ],
);

export const pieceKindEnum = pgEnum("piece_kind", ["essay", "proposal", "note", "forum"]);
export const manuscriptStatusEnum = pgEnum("manuscript_status", [
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
  "resubmitted",
  "accepted",
  "published",
  "declined",
  "withdrawn",
]);

export const manuscripts = pgTable(
  "manuscripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Null only for content migrated from the static site before accounts existed.
    authorId: text("author_id").references(() => user.id, { onDelete: "restrict" }),
    attributionNote: text("attribution_note"),
    kind: pieceKindEnum("kind").notNull(),
    status: manuscriptStatusEnum("status").notNull().default("draft"),
    title: text("title").notNull().default(""),
    deck: text("deck").notNull().default(""),
    abstract: text("abstract").notNull().default(""),
    bodyMd: text("body_md").notNull().default(""),
    authorBio: text("author_bio").notNull().default(""),
    disclosure: text("disclosure").notNull().default(""),
    version: integer("version").notNull().default(1),
    currentRevisionId: uuid("current_revision_id"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: now(),
    updatedAt: now(),
  },
  (t) => [
    index("manuscripts_author_idx").on(t.authorId, t.updatedAt),
    index("manuscripts_status_idx").on(t.status, t.updatedAt),
    check("migrated_or_owned", sql`${t.authorId} is not null or ${t.attributionNote} is not null`),
  ],
);

export const revisionSourceEnum = pgEnum("revision_source", ["author_submission", "editor_edit", "migration"]);

export const manuscriptRevisions = pgTable(
  "manuscript_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    manuscriptId: uuid("manuscript_id")
      .notNull()
      .references(() => manuscripts.id, { onDelete: "restrict" }),
    seq: integer("seq").notNull(),
    source: revisionSourceEnum("source").notNull(),
    kind: pieceKindEnum("kind").notNull(),
    title: text("title").notNull(),
    deck: text("deck").notNull(),
    abstract: text("abstract").notNull(),
    bodyMd: text("body_md").notNull(),
    authorBio: text("author_bio").notNull(),
    disclosure: text("disclosure").notNull(),
    note: text("note").notNull().default(""),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: now(),
  },
  (t) => [uniqueIndex("revision_seq_unique").on(t.manuscriptId, t.seq)],
);

export const reviewAssignments = pgTable(
  "review_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    manuscriptId: uuid("manuscript_id")
      .notNull()
      .references(() => manuscripts.id, { onDelete: "cascade" }),
    editorId: text("editor_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assignedBy: text("assigned_by").references(() => user.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    createdAt: now(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("one_active_assignment").on(t.manuscriptId, t.editorId).where(sql`${t.active}`),
    index("assignments_editor_idx").on(t.editorId, t.active),
  ],
);

export const recommendationEnum = pgEnum("recommendation", ["accept", "changes", "decline"]);

export const reviewRecommendations = pgTable(
  "review_recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    manuscriptId: uuid("manuscript_id")
      .notNull()
      .references(() => manuscripts.id, { onDelete: "cascade" }),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => manuscriptRevisions.id, { onDelete: "restrict" }),
    editorId: text("editor_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    recommendation: recommendationEnum("recommendation").notNull(),
    rationale: text("rationale").notNull().default(""),
    createdAt: now(),
  },
  (t) => [uniqueIndex("one_recommendation_per_editor_revision").on(t.revisionId, t.editorId)],
);

export const authorFeedback = pgTable(
  "author_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    manuscriptId: uuid("manuscript_id")
      .notNull()
      .references(() => manuscripts.id, { onDelete: "cascade" }),
    revisionId: uuid("revision_id").references(() => manuscriptRevisions.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: now(),
  },
  (t) => [index("feedback_manuscript_idx").on(t.manuscriptId, t.createdAt)],
);

export const internalNotes = pgTable(
  "internal_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    manuscriptId: uuid("manuscript_id")
      .notNull()
      .references(() => manuscripts.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: now(),
  },
  (t) => [index("notes_manuscript_idx").on(t.manuscriptId, t.createdAt)],
);

export const decisionEnum = pgEnum("editorial_decision", ["accept", "request_changes", "decline", "reopen"]);

export const editorialDecisions = pgTable(
  "editorial_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    manuscriptId: uuid("manuscript_id")
      .notNull()
      .references(() => manuscripts.id, { onDelete: "cascade" }),
    revisionId: uuid("revision_id").references(() => manuscriptRevisions.id, { onDelete: "restrict" }),
    decision: decisionEnum("decision").notNull(),
    authorNote: text("author_note").notNull().default(""),
    decidedBy: text("decided_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: now(),
  },
  (t) => [index("decisions_manuscript_idx").on(t.manuscriptId, t.createdAt)],
);

export const publicationChecks = pgTable(
  "publication_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    manuscriptId: uuid("manuscript_id")
      .notNull()
      .references(() => manuscripts.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    resolved: boolean("resolved").notNull().default(false),
    resolvedBy: text("resolved_by").references(() => user.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: now(),
  },
  (t) => [index("checks_manuscript_idx").on(t.manuscriptId)],
);

export const volumes = pgTable("volumes", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: integer("number").notNull().unique(),
  label: text("label").notNull(),
  yearLabel: text("year_label").notNull().default(""),
  createdAt: now(),
});

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    volumeId: uuid("volume_id")
      .notNull()
      .references(() => volumes.id, { onDelete: "restrict" }),
    number: integer("number").notNull(),
    termLabel: text("term_label").notNull(),
    visible: boolean("visible").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: now(),
  },
  (t) => [uniqueIndex("issue_number_unique").on(t.volumeId, t.number)],
);

export const publicationStateEnum = pgEnum("publication_state", ["live", "unpublished"]);

export const publications = pgTable(
  "publications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    manuscriptId: uuid("manuscript_id")
      .notNull()
      .unique()
      .references(() => manuscripts.id, { onDelete: "restrict" }),
    slug: text("slug").notNull().unique(),
    kind: pieceKindEnum("kind").notNull(),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    issueOrder: integer("issue_order").notNull().default(0),
    state: publicationStateEnum("state").notNull().default("live"),
    currentVersionId: uuid("current_version_id"),
    firstPublishedAt: timestamp("first_published_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: now(),
  },
  (t) => [
    index("publications_state_idx").on(t.state, t.kind),
    check("slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  ],
);

export const publicationVersions = pgTable(
  "publication_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicationId: uuid("publication_id")
      .notNull()
      .references(() => publications.id, { onDelete: "restrict" }),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => manuscriptRevisions.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    deck: text("deck").notNull(),
    abstract: text("abstract").notNull(),
    byline: text("byline").notNull(),
    authorBio: text("author_bio").notNull(),
    bodyHtml: text("body_html").notNull(),
    publishedBy: text("published_by").references(() => user.id, { onDelete: "set null" }),
    publishedAt: now(),
  },
  (t) => [index("versions_publication_idx").on(t.publicationId, t.publishedAt)],
);

export const meetingStatusEnum = pgEnum("meeting_status", ["draft", "announced", "held", "cancelled"]);

export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: meetingStatusEnum("status").notNull().default("draft"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    timezone: text("timezone").notNull().default("America/Los_Angeles"),
    location: text("location").notNull().default(""),
    motion: text("motion").notNull().default(""),
    openerFor: text("opener_for").notNull().default(""),
    openerAgainst: text("opener_against").notNull().default(""),
    attendancePolicy: text("attendance_policy").notNull().default(""),
    minutesMd: text("minutes_md").notNull().default(""),
    minutesPublished: boolean("minutes_published").notNull().default(false),
    version: integer("version").notNull().default(1),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: now(),
    updatedAt: now(),
  },
  (t) => [
    index("meetings_status_idx").on(t.status, t.startsAt),
    check("announced_has_time", sql`${t.status} = 'draft' or ${t.startsAt} is not null`),
  ],
);

export const pageVersionStatusEnum = pgEnum("page_version_status", [
  "draft",
  "proposed",
  "published",
  "superseded",
  "rejected",
]);

export const cmsPageVersions = pgTable(
  "cms_page_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageKey: text("page_key").notNull(),
    bodyMd: text("body_md").notNull(),
    status: pageVersionStatusEnum("status").notNull().default("draft"),
    note: text("note").notNull().default(""),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    decidedBy: text("decided_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: now(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("one_published_page_version").on(t.pageKey).where(sql`${t.status} = 'published'`),
    index("page_versions_key_idx").on(t.pageKey, t.createdAt),
  ],
);

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  updatedAt: now(),
});

export const mastheadEntries = pgTable("masthead_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  roleTitle: text("role_title").notNull(),
  personName: text("person_name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: now(),
});

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    manuscriptId: uuid("manuscript_id")
      .notNull()
      .references(() => manuscripts.id, { onDelete: "cascade" }),
    uploaderId: text("uploader_id").references(() => user.id, { onDelete: "set null" }),
    storageKey: text("storage_key").notNull().unique(),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: now(),
  },
  (t) => [index("attachments_manuscript_idx").on(t.manuscriptId)],
);

export const emailStatusEnum = pgEnum("email_status", [
  "queued",
  "sending",
  "accepted",
  "delivered",
  "bounced",
  "complained",
  "failed",
]);

export const emailJobs = pgTable(
  "email_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    toEmail: text("to_email").notNull(),
    toUserId: text("to_user_id").references(() => user.id, { onDelete: "set null" }),
    subject: text("subject").notNull(),
    textBody: text("text_body").notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    status: emailStatusEnum("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lastError: text("last_error"),
    providerMessageId: text("provider_message_id").unique(),
    createdAt: now(),
    updatedAt: now(),
  },
  (t) => [index("email_jobs_due_idx").on(t.status, t.nextAttemptAt)],
);

export const emailEvents = pgTable(
  "email_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id").references(() => emailJobs.id, { onDelete: "cascade" }),
    providerEventId: text("provider_event_id").unique(),
    type: text("type").notNull(),
    createdAt: now(),
  },
  (t) => [index("email_events_job_idx").on(t.jobId)],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: now(),
  },
  (t) => [
    index("audit_target_idx").on(t.targetType, t.targetId, t.createdAt),
    index("audit_created_idx").on(t.createdAt),
  ],
);

export const appRateLimits = pgTable("app_rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});
