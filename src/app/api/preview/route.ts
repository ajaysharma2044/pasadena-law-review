import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { rateLimit } from "@/server/ratelimit";
import { renderMarkdown } from "@/server/render/markdown";

/** Renders Markdown with the same sanitizer readers get. JSON in, JSON out. */
export const POST = mutation(async (req, input) => {
  const actor = await requireActor(req.headers);
  await rateLimit(`preview:${actor.userId}`, 120, 600);
  return { html: renderMarkdown((input.bodyMd ?? "").slice(0, 200_000)) };
});
