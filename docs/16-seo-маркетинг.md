# 16. SEO та маркетинг

Pulito має повноцінний стек технічного SEO та маркетингу життєвого циклу клієнта. Цей розділ описує дві великі частини:

1. **SEO** — структуровані дані (Schema.org JSON-LD), карти сайту (chunked sitemap), `robots.txt`, canonical, hreflang, OG/Twitter-картки, ISR, Google Shopping XML-фід, RSS, IndexNow, Google Search Console, `llms.txt`, SEO-шаблони, SEO-аудит, slug-редіректи (308), лог 404.
2. **Маркетинг** — email-кампанії та послідовності, відновлення кинутого кошика, win-back, повідомлення про надходження товару, купони/промокоди (інтегровані в checkout), банери, лояльність, реферали, сегменти клієнтів, публікації в соцмережі / автопостинг, Google Business, трекінг конверсій (Meta CAPI / Pixel).

Основні файли:

```
src/app/sitemap.ts
src/app/sitemap-products/[chunk]/route.ts
src/app/robots.ts
src/app/manifest.ts
src/app/opengraph-image.tsx
src/app/twitter-image.tsx
src/app/feed.xml/route.ts
src/app/feed/google-shopping/route.ts
src/app/blog/feed.xml/route.ts
src/app/llms.txt/route.ts
src/services/seo-template.ts
src/services/indexnow.ts
src/services/campaign.ts
src/services/email-sequences.ts
src/services/cart-recovery.ts
src/services/win-back.ts
src/services/back-in-stock.ts
src/services/coupon.ts
src/services/customer-segments.ts
src/services/loyalty.ts
src/services/referral.ts
src/services/publication.ts
src/services/server-tracking.ts
src/services/product-feeds.ts
src/generated/slug-redirects.ts
src/lib/i18n.ts
```

---

## Частина 1. SEO

### Карта сайту (sitemap)

`src/app/sitemap.ts` — головна карта. Працює в режимі `export const dynamic = 'force-dynamic'` (читає живу БД на запит; на CI зі stub-`DATABASE_URL` prerender падав би на build).

| Властивість  | Значення                                                                         |
| ------------ | -------------------------------------------------------------------------------- |
| Базовий URL  | `process.env.APP_URL` (fallback `http://localhost:3000`)                         |
| Розмір чанку | `PRODUCTS_PER_SITEMAP = 5000` товарів                                            |
| Чанкування   | при `productCount > 5000` повертається sitemap-index із посиланнями на під-карти |
| hreflang     | кожен URL отримує alternates через `buildHreflang(path)`                         |

Статичні сторінки з пріоритетами: `/` (1.0, daily), `/catalog` (0.9, daily), `/blog` (0.7), `/news` (0.7), `/bundles` (0.6), `/faq` (0.5) тощо.

**Під-карти товарів** — `src/app/sitemap-products/[chunk]/route.ts`:

- `GET(request, { params })` повертає XML-карту з товарами чанку.
- Вбудовує `<image:image>` (до 5 зображень на товар) для індексації в Google Images.
- Rate-limit; кеш-заголовки `public, max-age=3600, s-maxage=86400`.

### robots.txt

`src/app/robots.ts` повертає `MetadataRoute.Robots`. Закриває від обходу:

```
/api/   /admin/   /account   /auth/   /checkout/   /cart/   /comparison
```

- `/account` без trailing slash → закриває і сам `/account`, і `/account/*`.
- `/comparison` — user-specific (порівнювані товари в localStorage), тому Disallow економить crawl-budget (сторінка ще має `noindex`).
- Sitemap вказано як `${APP_URL}/sitemap.xml`.

### canonical, hreflang та локалізація

`src/lib/i18n.ts`:

| Функція                        | Призначення                                                     |
| ------------------------------ | --------------------------------------------------------------- |
| `buildHreflang(path)`          | повертає `Record<locale,string>` з URL по локалях + `x-default` |
| `localize(row, field, locale)` | вибір локалізованого поля з fallback (`nameEn → name`)          |
| `localizeSeo(row, locale)`     | резолв `seoTitle` + `seoDescription` під локаль                 |
| `applyTranslations*`           | inline-заміна базових полів на локальні варіанти                |

Конвенція схеми перекладів: `{field}` (uk), `{field}En`, `{field}Pl`, `{field}Ro`. Структурно сайт підтримує uk/en/pl/ro, проте реальний контент наразі український (UK-only), решта локалей — заготовки.

> Canonical-теги формуються на сторінках через Next.js `metadata.alternates.canonical` з абсолютним `APP_URL` (див. також [фікс Breadcrumb JSON-LD] — єдине джерело абсолютних URL).

### OG / Twitter-картки та PWA-manifest

| Файл                          | Що робить                                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/app/opengraph-image.tsx` | динамічна OG-картинка 1200×630 (`ImageResponse`, градієнт), бере `site_name` + `default_seo_description` з налаштувань       |
| `src/app/twitter-image.tsx`   | реекспорт OG-картинки для Twitter Cards                                                                                      |
| `src/app/manifest.ts`         | PWA-manifest: назва «Pulito Trade — Побутова хімія», іконки 192/512 (+maskable), screenshots wide/narrow, категорія shopping |

### ISR (incremental static regeneration)

Маршрути контенту, які не залежать від запиту (`llms.txt`, фіди), кешуються через `revalidate` (наприклад `llms.txt` — 3600 с, фіди — `FEED_CACHE_MAX_AGE = 1800`). Динамічні маршрути з БД (`sitemap`, `feed/google-shopping`) використовують `force-dynamic` + кеш-заголовки на рівні відповіді.

### Google Shopping XML-фід

`src/app/feed/google-shopping/route.ts` — `GET(request)` повертає повний фід для Google Merchant Center:

- ціни, зображення (головне + до 10 додаткових), наявність, категорії;
- мапінг локальних slug-категорій на таксономію Google;
- shipping-конфіг (Нова Пошта, 100 ₴ — поріг безкоштовної доставки);
- розрізняє `oldPrice` vs поточну ціну (індикатор знижки).

Генерація фідів спирається на `src/services/product-feeds.ts`:

| Функція                                          | Призначення                                                          |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| `getFeedContext()`                               | агрегує товари, категорії, налаштування → `FeedContext` (limit 5000) |
| `buildYmlCatalog(ctx)`                           | XML `yml_catalog` для Prom.ua / Epicentr                             |
| `escapeXml / escapeCdata / stripXmlControlChars` | XML-безпека                                                          |

### RSS-фіди

| Маршрут                          | Вміст                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `src/app/feed.xml/route.ts`      | RSS 2.0, останні 50 нових товарів (newest first), CDATA-escaping, rate-limit         |
| `src/app/blog/feed.xml/route.ts` | RSS 2.0 блогу, останні 50 опублікованих постів (категорія, теги, cover як enclosure) |

### IndexNow (Bing / Yandex / Seznam)

`src/services/indexnow.ts`:

| Функція                           | Призначення                                                   |
| --------------------------------- | ------------------------------------------------------------- |
| `submitToIndexNow(urls)`          | повідомляє Bing/Yandex/Seznam про зміну URL (до 10k за batch) |
| `submitProductsToIndexNow(slugs)` | обгортка для slug товарів                                     |

Fire-and-forget; пропускається поза production або при порожньому `INDEXNOW_KEY`. Ключ верифікації віддається на `/indexnow-key.txt`.

### Google Search Console

GSC верифіковано через HTML-файл; sitemap подано. On-site SEO (robots/sitemap/canonical/JSON-LD) закрите; основний важіль зростання — зовнішні сигнали + час (молодий домен). Інфраструктуру не «перемелювати».

### llms.txt (маніфест для AI-кролерів)

`src/app/llms.txt/route.ts` — `GET()` повертає prose-маніфест (`revalidate: 3600`): перелік Catalog, Blog, Brands, Bundles, News, Loyalty, FAQ, Contacts + посилання на sitemap, RSS, Google Shopping-фід та інструкції для кролерів. Бере `site_name` + `company_description` з налаштувань.

### Структуровані дані (Schema.org JSON-LD)

Компоненти в `src/components` (рендеряться як `<script type="application/ld+json">`):

| Компонент                        | @type                         | Деталі                                                                                                                                                         |
| -------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProductJsonLd`                  | `Product`                     | sku/mpn, GTIN (8/12/13/14), brand, category, `AggregateRating` (якщо `reviewCount > 0`), `Offer` (availability/price/priceCurrency); абсолютизує URL зображень |
| `ProductFaqJsonLd`               | `FAQPage`                     | `extractFaqItems(description)` парсить FAQ-блок (h2/h3 + пари питання-відповідь)                                                                               |
| `FaqJsonLd`                      | `FAQPage`                     | приймає `items: {question, answer}[]`                                                                                                                          |
| `BlogJsonLd`                     | `Article`                     | headline, description, datePublished/Modified, author (Person/Organization), publisher, articleSection                                                         |
| `ReviewAggregateJsonLd`          | `Product` + `AggregateRating` | `null` якщо `reviewCount = 0`                                                                                                                                  |
| `HowToJsonLd`                    | `HowTo`                       | кроки `HowToStep` + supplies (лише для реальних інструкцій)                                                                                                    |
| `SearchActionJsonLd`             | `WebSite`                     | `potentialAction/SearchAction`, target `/catalog?search={search_term_string}`                                                                                  |
| `Breadcrumbs` (BreadcrumbJsonLd) | `BreadcrumbList`              | єдине джерело хлібних крихт з абсолютним `APP_URL`                                                                                                             |

> Дублікати `WebSite`/`Organization`/`Product` свого часу були причиною помилок у GSC — наразі кожен тип має одне джерело.

### SEO-шаблони

`src/services/seo-template.ts` + `/admin/seo-templates`:

| Функція                                                     | Призначення                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------ |
| `getSeoTemplates()`                                         | усі шаблони                                                        |
| `getSeoTemplateByEntity(entityType, categoryId?)`           | шаблон під категорію з fallback на глобальний                      |
| `createSeoTemplate / updateSeoTemplate / deleteSeoTemplate` | CRUD з валідацією (P2002 → 409)                                    |
| `applyProductTemplate(template, vars)`                      | підстановка `{name}`, `{code}`, `{category}`, `{price}`, `{brand}` |
| `generateProductSeo(productId)`                             | авто-title/description для одного товару                           |
| `bulkGenerateProductSeo / bulkGenerateCategorySeo`          | пакетно по 100 → `{updated, total, remainingWithoutSeo}`           |
| `stripUnsafeChars()`                                        | видаляє XML-значущі символи (`<>"'&`)                              |

Ліміти: title ≤200 симв. (display ~70), description ≤500 (display ~160). Concise-титли ≤58 символів — генеруються через `buildConciseTitle` для нових товарів.

### SEO-аудит

`/admin/seo-audit` — самоперевірка сторінок (через `127.0.0.1`): довжина title, наявність description, canonical, JSON-LD, `seoGaps`. Стан: 57 titles ≤58, `seoGaps = 0`.

### Slug-редіректи (308)

`src/generated/slug-redirects.ts` — авто-генерується на деплої (`scripts/gen-slug-redirects.cjs`, вшито в `deploy.sh`):

```ts
export const PRODUCT_SLUG_REDIRECTS: Record<string, string>; // старий slug → новий
export const CATEGORY_SLUG_REDIRECTS: Record<string, string>;
```

Обробляється в `src/proxy.ts` ще до route-кешу — миттєвий 308 із врахуванням локалі (`/uk/`, `/en/`). Нові товари авто-коригуються (cap довжини slug + brand-first), старі slug ведуть на нові через статичну мапу.

### Лог 404

404 логуються для виявлення «битих» URL та можливих редіректів (доповнення до slug-мапи).

---

## Частина 2. Маркетинг

### Email-кампанії

`src/services/campaign.ts`:

| Функція                                                        | Призначення                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| `getCampaignRules(filters?)`                                   | активні правила / по RFM-сегменту + email-шаблон + лічильник логів |
| `createCampaignRule / updateCampaignRule / deleteCampaignRule` | CRUD                                                               |
| `executeCampaign(ruleId)`                                      | розсилка email на RFM-сегмент                                      |

Postgres advisory-locks (`CAMPAIGN_LOCK_NS`) серіалізують паралельні запуски правила (захист від дублів). HTML-escaping користувацьких полів (анти-інʼєкція в `fullName`). Частоти: `once / daily / weekly / monthly`.

### Email-послідовності

`src/services/email-sequences.ts`:

| Функція                  | Призначення                                                         |
| ------------------------ | ------------------------------------------------------------------- |
| `processWelcomeSeries()` | welcome новим (зареєстровані 24 год тому, verified, не заблоковані) |
| `processWinBack()`       | неактивні на 30/60/90 днів → ескалація знижки 5% / 10% / 15%        |

Повертають `{ sent }`.

### Відновлення кинутого кошика

`src/services/cart-recovery.ts` — `processCartRecovery()` (cron), трирівнева послідовність за часовим вікном:

| Рівень | Вікно     | Дія                               |
| ------ | --------- | --------------------------------- |
| 1      | 1–2 год   | «Ви забули кошик» — без купона    |
| 2      | 24–25 год | купон 5% (48 год дії)             |
| 3      | 72–73 год | купон 10% (48 год, фінальний пуш) |

Кожна пара (user, level) надсилається один раз (`CartRecoveryEvent` dedup). Купони — single-use, single-user. Купони з листів інтегровані в checkout (без інтеграції промокоди в листах не працювали б).

### Win-back

`src/services/win-back.ts` — `runWinBackCampaign(options?)`:

- ціль: користувачі із замовленням 60–180 днів тому, без win-back-листа за останні 90 днів;
- унікальний купон `COMEBACK-{hex}`, 10%, дія 14 днів;
- параметри: `minDaysDormant`, `maxDaysDormant`, `discountPercent`, `maxToSend`;
- dedup через `WinBackEvent`.

### Повідомлення про надходження (back-in-stock)

`src/services/back-in-stock.ts` — `processBackInStockNotifications()` → `{scanned, notified, failed}`:

- сканує `backInStockSubscription`, де товар має `quantity > 0` і ще не надіслано;
- batch 200/запуск; email + `notifiedAt`;
- лист містить фото, ціну, urgency (якщо ≤10 одиниць).

### Купони / промокоди

`src/services/coupon.ts` (інтегровані в `createOrder`):

| Функція                                                        | Призначення                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `validateCoupon(code, userId?, orderAmount?, cartProductIds?)` | active, dateRange, usageLimit, usageLimitPerUser, minOrderAmount, обмеження по категоріях/товарах |
| `calculateDiscount(coupon, orderAmount)`                       | type `percent`/`fixed` + `maxDiscount` cap                                                        |
| `redeemCoupon(couponId, userId, orderId)`                      | атомарне списання з компенсацією при відкаті                                                      |

Клас помилки `CouponError(message, statusCode)`. У checkout є поле вводу промокоду; редемпшн атомарний.

### Сегменти клієнтів

`src/services/customer-segments.ts` — `runSegment(input, options?)`:

- `rules`: масив `{field, op, value}`; `limit?`, `offset?`, `roles?`;
- поля: `orderCount`, `totalSpent`, `lastOrderDays`, `city`;
- оператори: `gte`, `lte`, `eq`, `contains`;
- ролі: `['client']` (default) / `['wholesaler']` / комбінація;
- in-memory cache 30 с (`SEGMENT_CACHE_TTL_MS`; `skipCache` для експортів);
- результат — список користувачів + статистика + лічильники сегментів.

Сегменти живлять кампанії (`campaign.ts`) та експорти.

### Лояльність

`src/services/loyalty.ts`:

| Функція                                    | Призначення                                                      |
| ------------------------------------------ | ---------------------------------------------------------------- |
| `getOrCreateLoyaltyAccount(userId)`        | lazy-ініціалізація рахунку                                       |
| `earnPoints(userId, orderId, orderAmount)` | нарахування з множником рівня + авто-tier-up (база: 1 бал / 1 ₴) |
| `spendPoints(userId, points, orderId)`     | атомарне списання з перевіркою балансу                           |
| `getLoyaltyLevels()`                       | рівні з `pointsMultiplier`, `minSpent`                           |
| `notifyLoyaltyTierUp(userId, level)`       | email-нотифікація (fire-and-forget після commit)                 |

### Реферали

`src/services/referral.ts`:

| Функція                                 | Призначення                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| `generateReferralCode()`                | 12-символьний hex (6 байт)                                                           |
| `getUserReferralStats(userId)`          | `referralCode`, `referralLink`, `totalReferred`, `convertedCount`, `totalBonusValue` |
| `processReferral(referredUserId, code)` | атрибуція + dedup                                                                    |

Статуси: `invited → first_order → bonus_granted`. Лінк: `/auth/register?ref={code}`. Клас `ReferralError(message, statusCode)`.

### Банери та лояльність в адмінці

Банери (рекламні блоки головної), правила лояльності й реферали керуються через адмін-панель і відображаються на вітрині (див. [07. Магазин](07-магазин.md)).

### Публікації в соцмережі / автопостинг

`src/services/publication.ts` — `createPublication(input, userId)`:

- канали: `telegram`, `viber` (лише контактне посилання `social_viber`; як API-канал Viber видалено), `facebook`, `instagram`, `site`;
- per-channel override (`channelContents`), watermark (`applyWatermark`);
- планування (`scheduledAt`) vs draft; статуси `draft/scheduled/published/failed`;
- санітизація для Telegram (whitelisting тегів `b/strong/i/em/u/s/a/code/pre/br/tg-spoiler`);
- Instagram (Reels + image-пости), Facebook, Telegram.

**Автопостинг** (promo-autopost) бере `CANDIDATE_WINDOW = 200` кандидатів; `batchSize` — лише темп (наприклад 2/запуск), не множник вікна. Stock-gate: не постити товари без залишку.

### Google Business

Профіль Google Business — частина зовнішніх сигналів SEO; інтеграція ведеться на рівні налаштувань і контактних даних магазину.

### Трекінг конверсій (Meta CAPI / Pixel)

`src/services/server-tracking.ts`:

| Функція                     | Призначення                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trackFacebookEvent(event)` | Meta Conversions API: нормалізація укр. телефону (`0XXX → 380XXX`) перед SHA-256, dedup через `eventID` (`eventName-orderId`), hashed email/phone/IP/UA/external_id |
| `trackPurchase(data)`       | обгортка для події Purchase (на завершенні замовлення)                                                                                                              |

Endpoint: `https://graph.facebook.com/{GRAPH_API_VERSION}/{PIXEL_ID}/events`. Потрібні `FACEBOOK_PIXEL_ID` + `FACEBOOK_CAPI_TOKEN`. ID події стандартизовано на `code` для всіх викликів `trackPurchase`. Клієнтський Meta Pixel доповнює серверні події дедуплікацією.

---

## Зведена таблиця сервісів

| Сервіс                 | Ключові функції                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `seo-template.ts`      | get/create/update/delete, `applyProductTemplate`, `generateProductSeo`, `bulkGenerate*` |
| `indexnow.ts`          | `submitToIndexNow`, `submitProductsToIndexNow`                                          |
| `i18n.ts`              | `buildHreflang`, `localize`, `localizeSeo`, `applyTranslations*`                        |
| `product-feeds.ts`     | `getFeedContext`, `buildYmlCatalog`, `escapeXml/Cdata`                                  |
| `campaign.ts`          | `getCampaignRules`, CRUD, `executeCampaign`                                             |
| `email-sequences.ts`   | `processWelcomeSeries`, `processWinBack`                                                |
| `cart-recovery.ts`     | `processCartRecovery`                                                                   |
| `win-back.ts`          | `runWinBackCampaign`                                                                    |
| `back-in-stock.ts`     | `processBackInStockNotifications`                                                       |
| `coupon.ts`            | `validateCoupon`, `calculateDiscount`, `redeemCoupon`                                   |
| `customer-segments.ts` | `runSegment`                                                                            |
| `loyalty.ts`           | `getOrCreateLoyaltyAccount`, `earnPoints`, `spendPoints`, `getLoyaltyLevels`            |
| `referral.ts`          | `generateReferralCode`, `getUserReferralStats`, `processReferral`                       |
| `publication.ts`       | `createPublication`                                                                     |
| `server-tracking.ts`   | `trackFacebookEvent`, `trackPurchase`                                                   |

---

---

## Пов'язані розділи

Повний перелік розділів документації:

- [Огляд проєкту](01-огляд-проєкту.md)
- [Технології (стек)](02-технології.md)
- [Архітектура](03-архітектура.md)
- [Встановлення та локальна розробка](04-встановлення.md)
- [Конфігурація (змінні оточення)](05-конфігурація-env.md)
- [База даних (Prisma-схема)](06-база-даних.md)
- [Магазин (вітрина)](07-магазин.md)
- [Особистий кабінет](08-особистий-кабінет.md)
- [B2B / гуртова торгівля](09-b2b-гурт.md)
- [Адмін-панель](10-адмін-панель.md)
- [Інтеграції](11-інтеграції.md)
- [Маркетплейси](12-маркетплейси.md)
- [Постачальники та імпорт](13-постачальники-імпорт.md)
- [REST API](14-api.md)
- [Безпека](15-безпека.md)
- **SEO та маркетинг** _(цей розділ)_
- [Аналітика та звіти](17-аналітика-звіти.md)
- [Multi-tenancy / SaaS](18-multi-tenancy.md)
- [Деплой та експлуатація](19-деплой-операції.md)
- [Тестування](20-тестування.md)

← Повернутись до [змісту документації](README.md)
