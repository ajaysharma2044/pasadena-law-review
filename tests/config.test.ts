import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "@/server/config";

const prod = {
  NODE_ENV: "production",
  APP_URL: "https://review.example.org",
  DATABASE_URL: "postgres://u:p@db.example.org:5432/plr",
  BETTER_AUTH_SECRET: "x".repeat(40),
  EMAIL_TRANSPORT: "resend",
  RESEND_API_KEY: "re_test_key",
  EMAIL_FROM: "The Review <editors@review.example.org>",
  STORAGE_DRIVER: "netlify-blobs",
  CRON_SECRET: "c".repeat(32),
};

function problems(env: Record<string, string>) {
  try {
    loadConfig(env);
    return [];
  } catch (e) {
    expect(e).toBeInstanceOf(ConfigError);
    return (e as ConfigError).problems;
  }
}

describe("configuration", () => {
  it("defaults to local development services outside production", () => {
    const c = loadConfig({ NODE_ENV: "development" });
    expect(c.strict).toBe(false);
    expect(c.database.kind).toBe("pglite");
    expect(c.email.transport).toBe("dev");
    expect(c.storage.driver).toBe("local");
  });

  it("refuses to start production with nothing configured, naming every missing setting", () => {
    const p = problems({ NODE_ENV: "production" });
    expect(p.join("\n")).toMatch(/APP_URL/);
    expect(p.join("\n")).toMatch(/DATABASE_URL/);
    expect(p.join("\n")).toMatch(/BETTER_AUTH_SECRET/);
    expect(p.join("\n")).toMatch(/EMAIL_TRANSPORT=dev is development-only/);
    expect(p.join("\n")).toMatch(/STORAGE_LOCAL_PERSISTENT/);
    expect(p.join("\n")).toMatch(/CRON_SECRET/);
  });

  it("accepts a complete production configuration", () => {
    const c = loadConfig(prod);
    expect(c.strict).toBe(true);
    expect(c.database).toEqual({ kind: "postgres", url: prod.DATABASE_URL });
    expect(c.email.transport).toBe("resend");
  });

  it("accepts Netlify DB's variable name", () => {
    const { DATABASE_URL, ...rest } = prod;
    const c = loadConfig({ ...rest, NETLIFY_DATABASE_URL: DATABASE_URL });
    expect(c.database.kind).toBe("postgres");
  });

  it("rejects insecure or development values in production", () => {
    expect(problems({ ...prod, APP_URL: "http://review.example.org" })).toContain("APP_URL must use https in production");
    expect(problems({ ...prod, BETTER_AUTH_SECRET: "short" }).join()).toMatch(/at least 32/);
    expect(problems({ ...prod, DATABASE_URL: "file:./local.db" }).join()).toMatch(/postgres:\/\//);
    expect(problems({ ...prod, STORAGE_DRIVER: "s3" }).join()).toMatch(/S3_BUCKET/);
    expect(problems({ ...prod, CRON_SECRET: "short" }).join()).toMatch(/CRON_SECRET must be at least 24/);
    expect(problems({ ...prod, RATE_LIMITS: "off" }).join()).toMatch(/RATE_LIMITS=off/);
  });

  it("treats empty values as unset (Netlify sends them to contexts without a value)", () => {
    const c = loadConfig({ NODE_ENV: "development", DATABASE_URL: "", RESEND_API_KEY: "  ", EMAIL_TRANSPORT: "" });
    expect(c.database.kind).toBe("pglite");
    expect(c.email.transport).toBe("dev");
    expect(problems({ ...prod, DATABASE_URL: "" }).join()).toMatch(/DATABASE_URL \(or NETLIFY_DATABASE_URL\) is required/);
  });

  it("requires provider credentials whenever Resend is selected, even locally", () => {
    expect(problems({ NODE_ENV: "development", EMAIL_TRANSPORT: "resend" }).join()).toMatch(/RESEND_API_KEY/);
  });

  it("only runs a production build on local services with the explicit preview flag", () => {
    const c = loadConfig({ NODE_ENV: "production", PLR_LOCAL_PREVIEW: "1" });
    expect(c.mode).toBe("local-preview");
    expect(c.strict).toBe(false);
  });
});
