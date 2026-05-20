-- Composite indexes for common audit-log query patterns:
--  * "all actions by user X" (sorted by date) → (user_id, created_at)
--  * "all actions on entity X#N" (sorted by date) → (entity_type, entity_id, created_at)
-- The retention cron also benefits — it scans by created_at and the existing
-- single-column (created_at) index covers that.

CREATE INDEX IF NOT EXISTS "audit_log_user_id_created_at_idx"
  ON "audit_log" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "audit_log_entity_type_entity_id_created_at_idx"
  ON "audit_log" ("entity_type", "entity_id", "created_at");
