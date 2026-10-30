import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { setBadge } from "@/server/services/badges";
export const POST=mutation(async(req,input)=>{
 const actor=await requireActor(req.headers,["admin"]);
 await setBadge(actor,input.userId??"",input.badgeKey??"",input.action??"",input.reason??"");
 return {ok:true,notice:"badge_updated"};
});
