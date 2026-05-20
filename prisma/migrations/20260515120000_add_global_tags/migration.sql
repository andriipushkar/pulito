-- Polymorphic tag system. A Tag is a label (name + color). EntityTag binds the
-- tag to any row in any table via (entity_type, entity_id) — that way the same
-- "vip" tag can sit on orders, products and users without three separate
-- tables. Trade-off: FK integrity isn't enforced at the DB level; the app
-- cleans up dangling EntityTag rows when entities are deleted.

CREATE TABLE "tags" (
  "id"         SERIAL PRIMARY KEY,
  "name"       VARCHAR(64) NOT NULL,
  "slug"       VARCHAR(64) NOT NULL,
  "color"      VARCHAR(16),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

CREATE TABLE "entity_tags" (
  "id"          SERIAL PRIMARY KEY,
  "tag_id"      INTEGER NOT NULL,
  "entity_type" VARCHAR(32) NOT NULL,
  "entity_id"   INTEGER NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "entity_tags_unique" ON "entity_tags"("tag_id", "entity_type", "entity_id");
CREATE INDEX "entity_tags_entity_idx" ON "entity_tags"("entity_type", "entity_id");

ALTER TABLE "entity_tags" ADD CONSTRAINT "entity_tags_tag_id_fkey"
  FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
