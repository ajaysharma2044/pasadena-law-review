import { mutation, redirectTo } from "@/server/http";
import { getAuth, isForm, withCookies } from "@/server/session-routes";

export const POST = mutation(async (req) => {
  const res = await getAuth().api.signOut({ headers: req.headers, asResponse: true });
  return withCookies(res, isForm(req) ? redirectTo("/", { notice: "signed_out" }) : Response.json({ ok: true }));
});
