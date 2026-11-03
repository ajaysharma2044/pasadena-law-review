import { requireActor } from "@/server/actor";
import { mutation } from "@/server/http";
import { setVisibility } from "@/server/services/badges";
export const POST=mutation(async(req,input)=>{
 const actor=await requireActor(req.headers);
 await setVisibility(actor,input.showBadges==="on");
 return {ok:true,notice:"badge_updated"};
});
