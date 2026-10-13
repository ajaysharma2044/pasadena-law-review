import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createHash } from "node:crypto";
import { getConfig } from "./config";
import { getDb } from "./db/client";
import * as schema from "./db/schema";
import { deliverSoon, enqueueEmail } from "./email/outbox";
import { templates } from "./email/templates";
import { getSettings } from "./services/settings";

/**
 * Authentication only: identities, password hashes, sessions and email tokens.
 * Roles and account status live in `memberships` and are enforced by the application.
 */

const tokenFingerprint = (token: string) => createHash("sha256").update(token).digest("hex").slice(0, 16);

function build() {
  const config = getConfig();
  const db = getDb();
  return betterAuth({
    appName: "Pasadena Law & Policy Review",
    baseURL: config.appUrl,
    basePath: "/api/auth",
    secret: config.authSecret,
    trustedOrigins: [config.appUrl],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        rateLimit: schema.rateLimit,
      },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url, token }) => {
        const pub = (await getSettings(db)).publication_name;
        const t = templates.resetPassword(pub, user.name, url);
        await enqueueEmail(db, {
          kind: "reset_password",
          to: user.email,
          toUserId: user.id,
          ...t,
          idempotencyKey: `reset:${user.id}:${tokenFingerprint(token)}`,
        });
        await deliverSoon();
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: false,
      // Opening the link confirms the address only. Signing in is separate, so opening someone else's
      // link can't sign you in to their account.
      autoSignInAfterVerification: false,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url, token }) => {
        const pub = (await getSettings(db)).publication_name;
        const t = templates.verifyEmail(pub, user.name, url);
        await enqueueEmail(db, {
          kind: "verify_email",
          to: user.email,
          toUserId: user.id,
          ...t,
          idempotencyKey: `verify:${user.id}:${tokenFingerprint(token)}`,
        });
        await deliverSoon();
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false }, // every request re-reads the session, so revocation is immediate
    },
    // Application wrappers apply rate limits; only GET link-handling endpoints are public.
    rateLimit: { enabled: false },
    advanced: {
      useSecureCookies: config.appUrl.startsWith("https://"),
      ipAddress: { ipAddressHeaders: [config.trustedIpHeader] },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const settings = await getSettings(db);
            await db
              .insert(schema.memberships)
              .values({ userId: user.id, role: "member", status: settings.membership_requires_approval ? "pending" : "active" })
              .onConflictDoNothing();
            await db
              .insert(schema.authorProfiles)
              .values({ userId: user.id, displayName: user.name })
              .onConflictDoNothing();
          },
        },
      },
    },
  });
}

type Auth = ReturnType<typeof build>;
let instance: Auth | null = null;

export function getAuth(): Auth {
  if (!instance) instance = build();
  return instance;
}

/** Tests only: rebuild after the config or database changes. */
export function resetAuthForTests() {
  instance = null;
}
