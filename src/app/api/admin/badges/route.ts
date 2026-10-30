import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { setBadge } from "@/server/services/badges";
export const POST=mutation(async(req,input)=>{
 const actor=await requireActor(req.headers,["admin"]);
 const changed = await setBadge(actor,input.userId??"",input.badgeKey??"",input.action??"",input.reason??"",input.appointmentConfirmed==="on");
 return {ok:true,notice:changed?"badge_updated":"badge_unchanged"};
});
