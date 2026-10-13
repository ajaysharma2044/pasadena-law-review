import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = 3300;
const dataDir = process.env.E2E_DATA_DIR ?? mkdtempSync(path.join(tmpdir(), "plr-e2e-"));
process.env.E2E_DATA_DIR = dataDir;
const env = {
  PLR_LOCAL_PREVIEW: "1",
  APP_URL: `http://localhost:${PORT}`,
  PGLITE_DIR: path.join(dataDir, "pglite"),
  STORAGE_LOCAL_DIR: path.join(dataDir, "uploads"),
  EMAIL_TRANSPORT: "dev",
  DEMO_PASSWORD: "demo-pass-2026!",
};

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.E2E_BROWSER === "chromium" ? undefined : "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run build && npm run db:seed:demo && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 240_000,
    reuseExistingServer: false,
    env,
  },
});
