import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Executor } from "../db/client";
import { siteSettings } from "../db/schema";

/** Global settings with safe defaults. Unknown facts default to empty, never to invented values. */
export const SettingsSchema = z.object({
  publication_name: z.string().min(1).max(120),
  publication_tagline: z.string().max(200),
  nameplate_issue_line: z.string().max(120),
  contact_email: z.string().max(200),
  instagram_handle: z.string().max(60),
  timezone: z.string().min(1),
  front_lead_publication_id: z.string().uuid().nullable(),
  masthead_published: z.boolean(),
  membership_requires_approval: z.boolean(),
  submissions_open: z.boolean(),
  submission_deadline_note: z.string().max(300),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  publication_name: "Pasadena City College Law Journal",
  publication_tagline: "A student journal of law and public policy",
  nameplate_issue_line: "Volume I, Fall 2026",
  contact_email: "",
  instagram_handle: "",
  timezone: "America/Los_Angeles",
  front_lead_publication_id: null,
  masthead_published: false,
  membership_requires_approval: false,
  submissions_open: true,
  submission_deadline_note: "",
};

export async function getSettings(db: Executor = getDb()): Promise<Settings> {
  const rows = await db.select().from(siteSettings);
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.key in DEFAULT_SETTINGS) merged[row.key] = row.value;
  }
  const parsed = SettingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function getSetting<K extends keyof Settings>(key: K, db: Executor = getDb()): Promise<Settings[K]> {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, key));
  if (!row) return DEFAULT_SETTINGS[key];
  const parsed = SettingsSchema.shape[key].safeParse(row.value);
  return (parsed.success ? parsed.data : DEFAULT_SETTINGS[key]) as Settings[K];
}
