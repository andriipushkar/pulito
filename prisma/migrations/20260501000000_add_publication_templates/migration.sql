-- Reusable templates for publications (Instagram/Telegram/Viber/Facebook posts)
CREATE TABLE IF NOT EXISTS "publication_templates" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "channels" JSONB NOT NULL,
    "title_template" TEXT,
    "content_template" TEXT NOT NULL,
    "hashtags_template" TEXT,
    "channel_contents" JSONB,
    "buttons" JSONB,
    "first_comment" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "publication_templates_name_key" ON "publication_templates"("name");
CREATE INDEX IF NOT EXISTS "publication_templates_is_active_idx" ON "publication_templates"("is_active");
