-- Restructure imported flat categories into proper hierarchy
-- Move subcategories under their correct parent categories

-- Under "Засоби для прання" (id=26)
UPDATE "categories" SET "parent_id" = 26 WHERE "id" IN (43, 44, 45, 46, 47, 48);
-- 43 = Гелі для прання
-- 44 = Порошки для прання
-- 45 = Капсули для прання
-- 46 = Серветки для прання
-- 47 = Кондиціонери-ополіскувачі для прання
-- 48 = Плямовивідники

-- Under "Засоби для миття та чищення" (id=24)
UPDATE "categories" SET "parent_id" = 24 WHERE "id" IN (49, 42);
-- 49 = Засоби для чищення
-- 42 = Morning Fresh apple (this is misnamed - rename it too)
UPDATE "categories" SET "name" = 'Засоби для миття посуду', "slug" = 'zasobi-dlya-mittya-posudu' WHERE "id" = 42;

-- Under "Засоби гігієни" (id=29)
UPDATE "categories" SET "parent_id" = 29 WHERE "id" IN (52, 50);
-- 52 = Засоби для ротової порожнини
-- 50 = Засоби для гоління

-- Under "Товари для дому" (id=27)
UPDATE "categories" SET "parent_id" = 27 WHERE "id" = 51;
-- 51 = Губки, скребки, ганчірки, швабри

-- "Різне" (id=53) stays as parent but gets higher sortOrder
UPDATE "categories" SET "sort_order" = 99 WHERE "id" = 53;
