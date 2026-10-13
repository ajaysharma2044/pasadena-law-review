# Ideas (not in this release)

These came up while building, but they're outside the brief. None of them is needed to launch.

- **Rich-text editing.** Replace the Markdown toolbar with a WYSIWYG editor that writes the same Markdown, so footnotes and small caps keep working.
- **Word import.** Turn an uploaded .docx into a Markdown draft. Parse it in an isolated worker, never in the web request.
- **Search.** Full-text search over published pieces with Postgres `tsvector`. The journal is small enough that an index page may do for a long time.
- **Citation export.** A "Cite as" block and RIS/BibTeX download on each article. The original static article had a "Cite as" line.
- **Scheduled publishing.** Publish at a set time through the scheduled function, once there is a reason to.
- **Meeting RSVPs and calendar files.** An `.ics` download for announced meetings; optional RSVP counts for room planning.
- **Reader notifications.** An opt-in email when a new issue appears. It needs consent records and unsubscribe handling before it's worth building.
- **Self-service account deletion and data export.** Today an administrator handles requests (`operations.md`).
- **Two-factor sign-in for administrators.** Better Auth supports it. Add it once there are several administrators.
- **Uptime and error reporting.** An external monitor on `/api/health`, and an error tracker for function logs.
- **Lazy PGlite import.** Keep the local-only database engine out of the production function bundle.
