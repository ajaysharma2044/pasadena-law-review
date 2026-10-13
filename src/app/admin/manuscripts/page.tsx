import { redirect } from "next/navigation";

/** Administrators use the same queue as editors, with every status available. */
export default function AdminManuscripts() {
  redirect("/editor?status=all");
}
