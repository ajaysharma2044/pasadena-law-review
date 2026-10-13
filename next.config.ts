import type { NextConfig } from "next";

const legacy = [
  ["/index.html", "/"],
  ["/issues.html", "/journal"],
  ["/meetings.html", "/meetings"],
  ["/submissions.html", "/submissions"],
  ["/about.html", "/about"],
  ["/masthead.html", "/masthead"],
  ["/articles/a-second-draft.html", "/articles/a-second-draft"],
] as const;

const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  async redirects() {
    return legacy.map(([source, destination]) => ({ source, destination, permanent: true }));
  },
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "X-Frame-Options", value: "DENY" },
    ];
    if (process.env.NODE_ENV === "production") {
      base.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
    }
    return [{ source: "/:path*", headers: base }];
  },
};

export default config;
