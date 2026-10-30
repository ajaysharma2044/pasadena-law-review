import Link from "next/link";
import { Page } from "@/components/ui";
import { BADGES, keys } from "@/server/services/badges";
export default function Recognition() {
 return <Page title="Contributor recognition" lede="Build a portfolio of carefully reviewed writing and service.">
  <p>Membership in PCC Law Journal Club is open to currently enrolled PCC students, with no GPA, application, attendance, or participation requirement. Dues are $0.</p>
  <p>Badges are optional recognition for documented contributions, not a condition of joining, an elected office, or access permissions. Administrators choose recipients; individuals control public display.</p>
  <ul>{keys.map(k=><li key={k}>{BADGES[k]}</li>)}</ul>
  <p>Research and publication remain subject to source verification and editorial review. The club President serves as Editor-in-Chief under the constitution.</p>
  <p><Link href="/signup">Join the site</Link> · <Link href="/submissions">Submit writing</Link></p>
 </Page>;
}
