import type { Input } from "./http";

export const checked = (input: Input, name: string) => ["on", "true", "1", "yes"].includes((input[name] ?? "").toLowerCase());
export const int = (input: Input, name: string, fallback = 0) => {
  const n = Number.parseInt(input[name] ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
};
