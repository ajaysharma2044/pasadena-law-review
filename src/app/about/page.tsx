import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedMasthead, getPublishedPage } from "@/server/services/public-content";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  const [about, independence, settings, masthead] = await Promise.all([
    getPublishedPage("about"),
    getPublishedPage("independence"),
    getSettings(),
    getPublishedMasthead(),
  ]);
  return (
    <main id="content">
      <div className="page-head narrow">
        <h1>About the Review</h1>
      </div>
      <div className="page narrow">
        <div className="prose">
          {about ? <div dangerouslySetInnerHTML={{ __html: about.html }} /> : null}
          {independence ? (
            <>
              <h2>Independence</h2>
              <div dangerouslySetInnerHTML={{ __html: independence.html }} />
            </>
          ) : null}
          {masthead ? (
            <>
              <h2>Editors</h2>
              <p>
                The current editors are listed on the <Link href="/masthead">masthead</Link>.
              </p>
            </>
          ) : null}
          <h2>Contact</h2>
          <p>
            {settings.contact_email ? (
              <>
                Write to <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>.{" "}
              </>
            ) : (
              "A public contact address hasn’t been published yet. "
            )}
            To join the staff, come to a <Link href="/meetings">meeting</Link> or{" "}
            <Link href="/account/apply">apply to be an editor</Link>. For submissions, see the{" "}
            <Link href="/submissions">guidelines</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
