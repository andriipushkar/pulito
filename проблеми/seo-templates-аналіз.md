# «Seo-templates» (SEO templates + bulk generate) — ТОП-7

| #   | Severity | Що                                                                                                                                                                                                                                                      |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ST1 | 🔴 HIGH  | Endpoint `/generate` без rate-limit — admin може loop-spam → DB hammer (100 products × N циклів × upsert)                                                                                                                                               |
| ST2 | 🔴 HIGH  | N+1 у `bulkGenerateProductSeo`: 2 SELECT per product (category-specific + global), 200 queries для 100 products                                                                                                                                         |
| ST3 | 🟠 HIGH  | XSS via template substitution: `product.name` зі спецсимволами (`<`, `"`) йде в `<title>` / `meta name="description"` без escape — frontend Next.js екранує атрибути, але manually-rendered XML feeds (sitemap, google-shopping) можуть бути вразливими |
| ST4 | 🟠 MED   | Bulk generate без `logAudit` — admin може silently змінити SEO 100 товарів                                                                                                                                                                              |
| ST5 | 🟡 MED   | `createSeoTemplate` P2002 (`@@unique([entityType, scope, categoryId])` collision) → generic 500 замість user-friendly 409 з поясненням «вже існує»                                                                                                      |
| ST6 | 🟡 MED   | Hard-coded `take: 100` без offset / remaining count → admin не знає, скільки ще лишилось без SEO                                                                                                                                                        |
| ST7 | 🟡 MED   | Zod schema відсутня — `body` йде сирим у `createSeoTemplate`, mass-assignment защищає тільки `update`; `entityType`, `scope` приймаються любі (нема enum)                                                                                               |

## Background

`seo-template.ts` — сервіс шаблонів для генерації `seoTitle`/`seoDescription` товарів. Один admin endpoint `/admin/seo-templates/generate` робить bulk-upsert у `ProductContent` для перших 100 товарів без SEO.

## Чому це важливо

- **ST1+ST2**: bulk generate = одна з найдорожчих admin-операцій. Без rate-limit + з N+1 — DB може лягти при 5-10 паралельних кліках.
- **ST3**: товари з лапками в назві (`'Сонячна "Енергія" 200W'`) → у sitemap.xml / google-shopping feed з'являються broken/exploitable значення. Frontend HTML — захищений Next.js JSX-escape, але XML feeds — це інший серіалайзер.
- **ST4**: повертає `{ updated: 87, total: 100 }` без сліду в audit. Якщо admin скаржиться «хтось перегенерував мій SEO» — нема як знайти хто.
- **ST5**: створення дубліката шаблону → користувач бачить «Помилка генерації SEO» замість «такий вже є».
