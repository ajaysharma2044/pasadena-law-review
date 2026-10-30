import Link from "next/link";
import type { ReactNode } from "react";

/** Messages for the `notice` / `error` codes routes put in redirect URLs. Unknown codes show nothing. */
const NOTICES: Record<string, string> = {
  check_email: "Check your email for a link to confirm your address. It works for one hour.",
  verification_sent: "If that address has an account waiting for confirmation, we sent a new link.",
  reset_sent: "If that address has an account, we sent a link to reset the password. It works for one hour.",
  password_reset: "Your password was changed, and you were signed out everywhere. Sign in with the new password.",
  password_changed: "Your password was changed. Other devices were signed out.",
  signed_out: "You’re signed out.",
  profile_saved: "Your public profile was saved.",
  application_sent: "Your application was sent. You’ll get an email when there’s a decision.",
  application_withdrawn: "Your application was withdrawn.",
  application_decided: "The application decision was recorded and the applicant was emailed.",
  role_changed: "The role was changed.",
  badge_updated: "Recognition was updated.",
  status_changed: "The account status was changed.",
  saved: "Saved.",
  draft_saved: "Draft saved.",
  submitted: "Submitted. A receipt is on its way to your email.",
  resubmitted: "Resubmitted. The editors have been told.",
  withdrawn: "The submission was withdrawn.",
  attachment_added: "The file was attached.",
  attachment_removed: "The file was removed.",
  claimed: "You’re now reviewing this manuscript.",
  assigned: "The reviewer was assigned.",
  released: "The assignment was released.",
  recommended: "Your recommendation was recorded.",
  feedback_sent: "Your comment is now visible to the author.",
  note_added: "Internal note added. Authors never see these.",
  edit_saved: "Your edit was saved as a new editorial revision.",
  decided: "The decision was recorded and the author was emailed.",
  check_updated: "The publication check was updated.",
  published: "Published. The article is live.",
  unpublished: "Unpublished. It no longer appears anywhere public.",
  restored: "The earlier version is live again.",
  page_proposed: "Your page change was sent to the administrators.",
  page_published: "The page change is live.",
  page_rejected: "The page change was declined.",
  meeting_saved: "The meeting was saved.",
  issue_saved: "The issue was saved.",
  settings_saved: "Settings saved.",
  masthead_saved: "The masthead was saved.",
  email_requeued: "The email was queued again.",
};

const ERRORS: Record<string, string> = {
  invalid: "Some of the information isn’t valid. Check the form and try again.",
  weak_password: "Use a password of at least 10 characters.",
  password_mismatch: "The two passwords don’t match.",
  signup_rejected: "That sign-up couldn’t be completed. Check the details and try again.",
  invalid_credentials: "That email and password don’t match an account.",
  email_unverified: "Confirm your email address before signing in. You can ask for a new link below.",
  invalid_or_expired_link: "That link is invalid or has expired. Ask for a new one.",
  wrong_password: "Your current password isn’t right.",
  rate_limited: "Too many attempts. Wait a few minutes and try again.",
  sign_in_required: "Sign in to continue.",
  forbidden: "You don’t have permission to do that.",
  cross_site: "That request didn’t come from this site. Reload the page and try again.",
  suspended: "This account is suspended.",
  pending_approval: "This account is waiting for an administrator’s approval.",
  not_found: "That item doesn’t exist or isn’t available to you.",
  conflict: "Someone else changed this in the meantime. Reload and try again.",
  stale: "Someone else changed this since you opened it. Reload to see their changes, then try again.",
  pending_exists: "You already have an application waiting for a decision.",
  already_editor: "You already have editorial access.",
  already_decided: "That has already been decided.",
  last_admin: "That would leave the site without an active administrator.",
  self_suspend: "You can’t suspend your own account.",
  self_decision: "Another administrator has to handle your own work.",
  submissions_closed: "Submissions are closed right now. Drafts you’ve started are kept.",
  self_review: "You can’t review your own work.",
  invalid_transition: "That action isn’t available at this stage.",
  reviews_required: "Two editors other than the author must recommend on the current version first.",
  checks_open: "Resolve every publication check before publishing.",
  slug_taken: "Another article already uses that web address.",
  bad_file: "Upload a PDF or Word (.docx) file under 10 MB.",
  unexpected: "Something went wrong. Nothing was saved. Try again.",
};

export function Flash({ notice, error }: { notice?: string; error?: string }) {
  const n = notice ? NOTICES[notice] : null;
  const e = error ? ERRORS[error] : null;
  if (!n && !e) return null;
  return (
    <div className={`notice ${e ? "notice-error" : "notice-success"}`} role={e ? "alert" : "status"}>
      {e ?? n}
    </div>
  );
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function flashFrom(searchParams: SearchParams) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  return { notice: one("notice"), error: one("error"), sp, one };
}

export function AccessDenied({ reason }: { reason: string }) {
  const text: Record<string, string> = {
    forbidden: "Your account doesn’t have access to this page.",
    suspended: "This account is suspended, so it can’t use private pages. Contact the editors if you think this is a mistake.",
    pending_approval: "This account is waiting for an administrator’s approval.",
    email_unverified: "Confirm your email address to use this page.",
  };
  return (
    <main id="content" className="app-page narrow">
      <h1>Access denied</h1>
      <p className="lede">{text[reason] ?? text.forbidden}</p>
      <p>
        <Link href="/">Front page</Link> · <Link href="/account">Your account</Link>
      </p>
    </main>
  );
}

/** Hidden fields telling the route where to return on error and where to go on success. */
export function FormNav({ back, next }: { back: string; next?: string }) {
  return (
    <>
      <input type="hidden" name="_back" value={back} />
      {next ? <input type="hidden" name="_next" value={next} /> : null}
    </>
  );
}

export function Page({ title, lede, children, wide }: { title: string; lede?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <main id="content" className={`app-page ${wide ? "wrap" : "narrow"}`}>
      <h1>{title}</h1>
      {lede ? <p className="lede">{lede}</p> : null}
      {children}
    </main>
  );
}

export function formatDateTime(d: Date | string | null | undefined, tz = "America/Los_Angeles") {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(d));
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  in_review: "In review",
  changes_requested: "Changes requested",
  resubmitted: "Resubmitted",
  accepted: "Accepted",
  published: "Published",
  declined: "Declined",
  withdrawn: "Withdrawn",
};
