import { expect } from "vitest";

/** Drizzle wraps driver errors ("Failed query: …"); the database's own message is in `cause`. */
export async function expectDbError(p: Promise<unknown>, pattern: RegExp) {
  try {
    await p;
  } catch (e) {
    const err = e as Error & { cause?: { message?: string } };
    expect(`${err.message} ${err.cause?.message ?? ""}`).toMatch(pattern);
    return;
  }
  throw new Error(`expected a database error matching ${pattern}`);
}
