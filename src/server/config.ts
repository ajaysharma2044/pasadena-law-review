import { z } from "zod";

/**
 * Runtime configuration. Production refuses to start unless real services are configured.
 * Local development falls back to PGlite, the development mailbox and local file storage,
 * and every page says so.
 */

const optional = z.string().trim().min(1).optional();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().optional(),
  URL: optional, // set by Netlify at build and run time
  DATABASE_URL: optional,
  NETLIFY_DATABASE_URL: optional,
  PGLITE_DIR: z.string().default(".data/pglite"),
  BETTER_AUTH_SECRET: optional,
  EMAIL_TRANSPORT: z.enum(["dev", "resend"]).default("dev"),
  RESEND_API_KEY: optional,
  RESEND_WEBHOOK_SECRET: optional,
  EMAIL_FROM: optional,
  EMAIL_REPLY_TO: optional,
  STORAGE_DRIVER: z.enum(["local", "netlify-blobs", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default(".data/uploads"),
  STORAGE_LOCAL_PERSISTENT: z.enum(["true", "false"]).default("false"),
  NETLIFY_BLOBS_STORE: z.string().default("manuscript-attachments"),
  S3_ENDPOINT: optional,
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: optional,
  S3_ACCESS_KEY_ID: optional,
  S3_SECRET_ACCESS_KEY: optional,
  CRON_SECRET: optional,
  RATE_LIMITS: z.enum(["on", "off"]).default("on"),
  // The one request header that carries the client's address, set by the host's own proxy. Netlify's
  // is the default. Clients can send any header themselves, so no other header is ever trusted.
  TRUSTED_IP_HEADER: z
    .string()
    .regex(/^[A-Za-z0-9-]+$/, "must be a header name")
    .default("x-nf-client-connection-ip")
    .transform((h) => h.toLowerCase()),
  // Explicit opt-in for running a production build locally (e2e tests). Shows a warning banner.
  PLR_LOCAL_PREVIEW: z.enum(["1", "0"]).default("0"),
});

export type DatabaseConfig = { kind: "postgres"; url: string } | { kind: "pglite"; dir: string | null };

export type AppConfig = {
  mode: "development" | "test" | "production" | "local-preview";
  strict: boolean;
  appUrl: string;
  database: DatabaseConfig;
  authSecret: string;
  email:
    | { transport: "dev"; from: string; replyTo: string | null }
    | { transport: "resend"; apiKey: string; from: string; replyTo: string | null; webhookSecret: string | null };
  storage:
    | { driver: "local"; dir: string; persistent: boolean }
    | { driver: "netlify-blobs"; store: string }
    | { driver: "s3"; endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string };
  cronSecret: string | null;
  rateLimits: boolean;
  trustedIpHeader: string;
};

export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid configuration:\n- ${problems.join("\n- ")}`);
    this.name = "ConfigError";
  }
}

// Used only when not in strict mode, so local sessions survive restarts. Never valid in production.
const DEV_AUTH_SECRET = "development-only-secret-not-for-production-use-0000";

export function loadConfig(source: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  }
  const env = parsed.data;
  const localPreview = env.NODE_ENV === "production" && env.PLR_LOCAL_PREVIEW === "1";
  const strict = env.NODE_ENV === "production" && !localPreview;
  const mode: AppConfig["mode"] = localPreview ? "local-preview" : env.NODE_ENV;
  const problems: string[] = [];

  const appUrl = env.APP_URL ?? env.URL ?? "http://localhost:3000";
  if (strict && !(env.APP_URL ?? env.URL)) problems.push("APP_URL is required in production");
  if (strict && !appUrl.startsWith("https://")) problems.push("APP_URL must use https in production");

  const dbUrl = env.DATABASE_URL ?? env.NETLIFY_DATABASE_URL;
  let database: DatabaseConfig;
  if (dbUrl) {
    if (!/^postgres(ql)?:\/\//.test(dbUrl)) problems.push("DATABASE_URL must be a postgres:// URL");
    database = { kind: "postgres", url: dbUrl };
  } else {
    if (strict) problems.push("DATABASE_URL (or NETLIFY_DATABASE_URL) is required in production; PGlite is development-only");
    database = { kind: "pglite", dir: env.NODE_ENV === "test" ? null : env.PGLITE_DIR };
  }

  let authSecret = env.BETTER_AUTH_SECRET ?? "";
  if (strict) {
    if (authSecret.length < 32) problems.push("BETTER_AUTH_SECRET must be at least 32 characters in production");
    if (authSecret === DEV_AUTH_SECRET) problems.push("BETTER_AUTH_SECRET must not be the development secret");
  } else if (!authSecret) {
    authSecret = DEV_AUTH_SECRET;
  }

  let email: AppConfig["email"];
  if (env.EMAIL_TRANSPORT === "resend") {
    if (!env.RESEND_API_KEY) problems.push("RESEND_API_KEY is required when EMAIL_TRANSPORT=resend");
    if (!env.EMAIL_FROM) problems.push("EMAIL_FROM is required when EMAIL_TRANSPORT=resend");
    email = {
      transport: "resend",
      apiKey: env.RESEND_API_KEY ?? "",
      from: env.EMAIL_FROM ?? "",
      replyTo: env.EMAIL_REPLY_TO ?? null,
      webhookSecret: env.RESEND_WEBHOOK_SECRET ?? null,
    };
  } else {
    if (strict) problems.push("EMAIL_TRANSPORT=dev is development-only; set EMAIL_TRANSPORT=resend in production");
    email = { transport: "dev", from: env.EMAIL_FROM ?? "Development Mailbox <dev@localhost>", replyTo: env.EMAIL_REPLY_TO ?? null };
  }

  let storage: AppConfig["storage"];
  if (env.STORAGE_DRIVER === "s3") {
    for (const k of ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
      if (!env[k]) problems.push(`${k} is required when STORAGE_DRIVER=s3`);
    }
    storage = {
      driver: "s3",
      endpoint: env.S3_ENDPOINT ?? "",
      region: env.S3_REGION,
      bucket: env.S3_BUCKET ?? "",
      accessKeyId: env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "",
    };
  } else if (env.STORAGE_DRIVER === "netlify-blobs") {
    storage = { driver: "netlify-blobs", store: env.NETLIFY_BLOBS_STORE };
  } else {
    const persistent = env.STORAGE_LOCAL_PERSISTENT === "true";
    if (strict && !persistent) {
      problems.push(
        "STORAGE_DRIVER=local in production requires STORAGE_LOCAL_PERSISTENT=true (a persistent volume on a single instance); on Netlify use netlify-blobs",
      );
    }
    storage = { driver: "local", dir: env.STORAGE_LOCAL_DIR, persistent };
  }

  if (strict && !env.CRON_SECRET) problems.push("CRON_SECRET is required in production (protects the job runner)");
  if (env.CRON_SECRET && env.CRON_SECRET.length < 24) problems.push("CRON_SECRET must be at least 24 characters");
  if (strict && env.RATE_LIMITS === "off") problems.push("RATE_LIMITS=off is not allowed in production");

  if (problems.length) throw new ConfigError(problems);

  return {
    mode,
    strict,
    appUrl: appUrl.replace(/\/$/, ""),
    database,
    authSecret,
    email,
    storage,
    cronSecret: env.CRON_SECRET ?? null,
    rateLimits: env.RATE_LIMITS === "on",
    trustedIpHeader: env.TRUSTED_IP_HEADER,
  };
}

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!cached) cached = loadConfig();
  return cached;
}

/** Tests only. */
export function setConfigForTests(config: AppConfig | null) {
  cached = config;
}

/** True when real external services are in use (nothing local or simulated). */
export function usesRealServices(config: AppConfig) {
  return config.database.kind === "postgres" && config.email.transport === "resend" && config.storage.driver !== "local";
}
