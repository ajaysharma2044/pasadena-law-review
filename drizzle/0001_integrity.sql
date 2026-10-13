-- Immutable history: revisions, published versions and audit events can't be edited or deleted.
-- The only permitted change is the actor reference becoming NULL when that account is deleted.
CREATE OR REPLACE FUNCTION plr_immutable_except_actor_nulling() RETURNS trigger AS $$
DECLARE
  col text := TG_ARGV[0];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '% rows are immutable', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
  END IF;
  IF (to_jsonb(NEW) - col) = (to_jsonb(OLD) - col) AND (to_jsonb(NEW) ->> col) IS NULL THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '% rows are immutable', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER manuscript_revisions_immutable BEFORE UPDATE OR DELETE ON "manuscript_revisions"
  FOR EACH ROW EXECUTE FUNCTION plr_immutable_except_actor_nulling('created_by');
--> statement-breakpoint
CREATE TRIGGER publication_versions_immutable BEFORE UPDATE OR DELETE ON "publication_versions"
  FOR EACH ROW EXECUTE FUNCTION plr_immutable_except_actor_nulling('published_by');
--> statement-breakpoint
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION plr_immutable_except_actor_nulling('actor_id');
--> statement-breakpoint
-- Circular pointers, checked at commit time.
ALTER TABLE "manuscripts" ADD CONSTRAINT "manuscripts_current_revision_fk"
  FOREIGN KEY ("current_revision_id") REFERENCES "manuscript_revisions"("id")
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_current_version_fk"
  FOREIGN KEY ("current_version_id") REFERENCES "publication_versions"("id")
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
