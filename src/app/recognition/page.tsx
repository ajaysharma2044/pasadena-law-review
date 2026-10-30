import Link from "next/link";
import { Page } from "@/components/ui";
import { BADGES, BADGE_CRITERIA, keys } from "@/server/services/badges";
export default function Recognition() {
 return <Page title="Contributor recognition" lede="Build a portfolio of carefully reviewed writing and service.">
  <p>Membership in PCC Law Journal Club is open to currently enrolled PCC students, with no GPA, application, attendance, or participation requirement. Dues are $0.</p>
  <p>Badges are optional recognition for documented contributions, not a condition of joining, an elected office, or access permissions. Administrators choose recipients; individuals control public display.</p>
  <dl>{keys.map(k=><div key={k}><dt><strong>{BADGES[k]}</strong></dt><dd>{BADGE_CRITERIA[k]}</dd></div>)}</dl>
  <p>Recognition is discretionary, based on documented work, and may be revoked. Members may keep their membership confidential by contacting a club officer. Badges are private by default; public display requires the contributor's explicit opt-in in Account, and consent can be withdrawn at any time.</p>
  <p>Research and publication remain subject to source verification and editorial review. Both constitution versions supplied to the journal pair the Presidency with Editor-in-Chief. The drafts differ on other offices and succession; official titles must follow the constitution actually adopted and its election, vacancy, and appointment procedures. A website administrator or recognition badge does not establish such an appointment.</p>
  <p><Link href="/signup">Join the site</Link> · <Link href="/submissions">Submit writing</Link></p>
 </Page>;
}
