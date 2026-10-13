/**
 * Plain-text transactional emails. They carry a status summary and a link back to the site,
 * never manuscript text or internal editorial notes.
 */

type Rendered = { subject: string; text: string };

const sign = (pub: string) => `\n\n${pub}`;

export const templates = {
  verifyEmail: (pub: string, name: string, url: string): Rendered => ({
    subject: `Confirm your email for ${pub}`,
    text: `Hello ${name},\n\nConfirm your email address to finish creating your account:\n\n${url}\n\nThe link works for one hour. If you didn't sign up, ignore this message.${sign(pub)}`,
  }),
  resetPassword: (pub: string, name: string, url: string): Rendered => ({
    subject: `Reset your password for ${pub}`,
    text: `Hello ${name},\n\nSomeone asked to reset the password for this account. To choose a new password, open:\n\n${url}\n\nThe link works for one hour and only once. If you didn't ask for this, ignore this message; your password hasn't changed.${sign(pub)}`,
  }),
  applicationReceived: (pub: string, name: string, url: string): Rendered => ({
    subject: `We received your editor application`,
    text: `Hello ${name},\n\nThanks for applying to join the editors of ${pub}. An administrator will review the application, and you'll get an email when there's a decision. You can check its status at:\n\n${url}${sign(pub)}`,
  }),
  applicationDecided: (pub: string, name: string, approved: boolean, note: string, url: string): Rendered => ({
    subject: approved ? `You're now an editor` : `About your editor application`,
    text: `Hello ${name},\n\n${
      approved
        ? `Your application to edit for ${pub} was approved. The editor's queue is now available when you sign in.`
        : `Your application to edit for ${pub} was not approved this time.`
    }${note ? `\n\nNote from the editors: ${note}` : ""}\n\n${url}${sign(pub)}`,
  }),
  submissionReceived: (pub: string, name: string, title: string, url: string): Rendered => ({
    subject: `Received: “${title}”`,
    text: `Hello ${name},\n\nWe received your submission, “${title}.” Two editors will read it. You can follow its status at:\n\n${url}${sign(pub)}`,
  }),
  newSubmissionForEditors: (pub: string, title: string, kind: string, url: string): Rendered => ({
    subject: `New submission in the queue: “${title}”`,
    text: `A new ${kind} was submitted to ${pub}: “${title}.”\n\nOpen the review queue:\n\n${url}${sign(pub)}`,
  }),
  reviewAssigned: (pub: string, name: string, title: string, url: string): Rendered => ({
    subject: `Assigned to you: “${title}”`,
    text: `Hello ${name},\n\nYou've been assigned to review “${title}.”\n\n${url}${sign(pub)}`,
  }),
  decisionForAuthor: (pub: string, name: string, title: string, decision: "accept" | "request_changes" | "decline", url: string): Rendered => {
    const line = {
      accept: `“${title}” has been accepted. The editors will finish the cite-check before it is published.`,
      request_changes: `The editors have asked for changes to “${title}.” Their comments are in your dashboard, and you can resubmit there.`,
      decline: `The editors have decided not to publish “${title}.” Their note is in your dashboard.`,
    }[decision];
    return {
      subject: { accept: `Accepted: “${title}”`, request_changes: `Changes requested: “${title}”`, decline: `Decision on “${title}”` }[decision],
      text: `Hello ${name},\n\n${line}\n\n${url}${sign(pub)}`,
    };
  },
  published: (pub: string, name: string, title: string, url: string): Rendered => ({
    subject: `Published: “${title}”`,
    text: `Hello ${name},\n\n“${title}” is now published:\n\n${url}${sign(pub)}`,
  }),
};
