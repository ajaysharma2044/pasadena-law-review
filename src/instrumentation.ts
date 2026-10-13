/** Validates configuration at startup and prepares the local development database. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getConfig } = await import("./server/config");
  const config = getConfig(); // throws ConfigError, which stops the server, if production settings are missing
  if (!config.strict && config.database.kind === "pglite") {
    const { getDb } = await import("./server/db/client");
    const { runMigrations } = await import("./server/db/migrate");
    const { seedContent } = await import("./server/seed/content");
    const db = getDb();
    await runMigrations(db, "pglite");
    await seedContent(db);
  }
}
