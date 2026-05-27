-- Add EN translation columns to content models. All nullable so existing
-- rows keep working with the uk-language fallback; admins fill these via
-- the admin UI tabs (EN-вкладка) introduced in Phase 3.

-- products
ALTER TABLE "products" ADD COLUMN "name_en" VARCHAR(255);

-- product_content
ALTER TABLE "product_content" ADD COLUMN "short_description_en" VARCHAR(200);
ALTER TABLE "product_content" ADD COLUMN "full_description_en" TEXT;
ALTER TABLE "product_content" ADD COLUMN "specifications_en" TEXT;
ALTER TABLE "product_content" ADD COLUMN "usage_instructions_en" TEXT;
ALTER TABLE "product_content" ADD COLUMN "seo_title_en" TEXT;
ALTER TABLE "product_content" ADD COLUMN "seo_description_en" TEXT;

-- brands
ALTER TABLE "brands" ADD COLUMN "name_en" VARCHAR(255);
ALTER TABLE "brands" ADD COLUMN "description_en" TEXT;
ALTER TABLE "brands" ADD COLUMN "seo_title_en" TEXT;
ALTER TABLE "brands" ADD COLUMN "seo_description_en" TEXT;

-- bundles
ALTER TABLE "bundles" ADD COLUMN "name_en" TEXT;
ALTER TABLE "bundles" ADD COLUMN "description_en" TEXT;

-- categories
ALTER TABLE "categories" ADD COLUMN "name_en" TEXT;
ALTER TABLE "categories" ADD COLUMN "description_en" TEXT;
ALTER TABLE "categories" ADD COLUMN "seo_title_en" TEXT;
ALTER TABLE "categories" ADD COLUMN "seo_description_en" TEXT;

-- static_pages
ALTER TABLE "static_pages" ADD COLUMN "title_en" TEXT;
ALTER TABLE "static_pages" ADD COLUMN "content_en" TEXT;
ALTER TABLE "static_pages" ADD COLUMN "seo_title_en" TEXT;
ALTER TABLE "static_pages" ADD COLUMN "seo_description_en" TEXT;

-- faq_categories
ALTER TABLE "faq_categories" ADD COLUMN "name_en" TEXT;
ALTER TABLE "faq_categories" ADD COLUMN "description_en" TEXT;

-- faq_items
ALTER TABLE "faq_items" ADD COLUMN "question_en" TEXT;
ALTER TABLE "faq_items" ADD COLUMN "answer_en" TEXT;

-- blog_categories
ALTER TABLE "blog_categories" ADD COLUMN "name_en" TEXT;
ALTER TABLE "blog_categories" ADD COLUMN "description_en" TEXT;
ALTER TABLE "blog_categories" ADD COLUMN "seo_title_en" TEXT;
ALTER TABLE "blog_categories" ADD COLUMN "seo_description_en" TEXT;

-- blog_posts
ALTER TABLE "blog_posts" ADD COLUMN "title_en" TEXT;
ALTER TABLE "blog_posts" ADD COLUMN "excerpt_en" VARCHAR(500);
ALTER TABLE "blog_posts" ADD COLUMN "content_en" TEXT;
ALTER TABLE "blog_posts" ADD COLUMN "seo_title_en" TEXT;
ALTER TABLE "blog_posts" ADD COLUMN "seo_description_en" TEXT;
