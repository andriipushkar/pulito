# Інвентаризація проєкту Pulito Trade — 2026-06-10 (ЕТАП 1)

> Read-only звіт. Гілка: `auto-fixes`. Жодних змін коду не внесено.

## 0. Безпека (ЕТАП 0 — результат)

- Гілка `auto-fixes` створена від `fix/auth-refresh-401-and-build-memory`.
- `.gitignore` покриває `.env*`, `*.pem`, env-бекапи, uploads, docker-data — ОК.
- Скан git-історії (шляхи + pickaxe на `sk_live_`, `sk-ant-`, `BEGIN PRIVATE KEY`, Telegram-токени): **реальних секретів не знайдено**. Збіги — лише плейсхолдери в `.env.example`/доках та фейкові тест-фікстури (`sk_live_12345678abcdefgh` у `payment-settings/route.test.ts`). Ротація ключів не потрібна.

---

## 1. Дерево роутів адмінки (103 page.tsx) — як структура меню

Поточний сайдбар уже має 11 секцій (`ADMIN_SECTIONS`), з пінами, пошуком, Ctrl+K-палітрою та live-бейджами (нові замовлення, опт на погодженні).

### Огляд / Аналітика

| Роут                   | Призначення                                      |
| ---------------------- | ------------------------------------------------ |
| /admin                 | Головна панель: віджети статистики, рекомендації |
| /admin/analytics       | Детальна аналітика продажів/клієнтів/товарів     |
| /admin/reports         | Користувацькі звіти                              |
| /admin/reports/builder | Конструктор звітів (фільтри, графіки)            |
| /admin/tax-report      | Податковий звіт ФОП (касовий метод, CSV)         |
| /admin/forecasting     | Прогнозування попиту                             |
| /admin/search-intel    | Аналіз пошукових запитів                         |

### Замовлення

| Роут                   | Призначення                                |
| ---------------------- | ------------------------------------------ |
| /admin/orders          | Список замовлень (фільтри, статуси, пошук) |
| /admin/orders/[id]     | Деталі/редагування замовлення, TTN         |
| /admin/orders/board    | Kanban-дошка замовлень                     |
| /admin/orders/bulk     | Масове редагування                         |
| /admin/pack            | Пакування/комплектування                   |
| /admin/scan-sheets     | Реєстри Нової Пошти                        |
| /admin/pallet-delivery | Палетна/масова доставка                    |
| /admin/subscriptions   | Підписки клієнтів                          |

### Каталог

| Роут                                | Призначення                          |
| ----------------------------------- | ------------------------------------ |
| /admin/products                     | Список товарів (inline ціни/залишки) |
| /admin/products/new                 | Створення товару                     |
| /admin/products/[id]                | Редагування товару                   |
| /admin/products/image-quality       | Аналіз якості фото                   |
| /admin/products/duplicates          | Пошук дублів                         |
| /admin/categories                   | Категорії (drag&drop, вкладеність)   |
| /admin/brands                       | Бренди                               |
| /admin/bundles, /admin/bundles/[id] | Комплекти                            |
| /admin/badges                       | Мітки/бейджі товарів                 |
| /admin/import                       | Імпорт каталогу з файлу              |

### Склад

| Роут                                    | Призначення              |
| --------------------------------------- | ------------------------ |
| /admin/warehouses, /[id]                | Склади, локації          |
| /admin/stock-counts, /[id]              | Інвентаризації           |
| /admin/warehouse-transfers, /new, /[id] | Переміщення між складами |

### Клієнти

| Роут                | Призначення                          |
| ------------------- | ------------------------------------ |
| /admin/users, /[id] | Клієнти, профіль, замовлення, баланс |
| /admin/segments     | Сегментація для маркетингу           |

### Маркетинг

| Роут                                | Призначення          |
| ----------------------------------- | -------------------- |
| /admin/campaigns                    | Кампанії, push       |
| /admin/volume-discounts             | Знижки за обсяг      |
| /admin/personal-prices              | Персональні ціни     |
| /admin/wholesale-rules              | Оптові правила       |
| /admin/loyalty, /loyalty/challenges | Лояльність, челенджі |
| /admin/referrals                    | Реферальна програма  |
| /admin/coupons                      | Купони/промокоди     |
| /admin/banners                      | Банери               |

### Контент

| Роут                                       | Призначення          |
| ------------------------------------------ | -------------------- |
| /admin/blog, /[id], /categories, /comments | Блог                 |
| /admin/pages, /[id]                        | Інфо-сторінки        |
| /admin/faq, /faq/categories                | FAQ                  |
| /admin/email-templates                     | Email-шаблони        |
| /admin/feedback                            | Відгуки/пропозиції   |
| /admin/homepage                            | Конструктор головної |
| /admin/themes                              | Теми оформлення      |

### Маркетплейси та інтеграції

| Роут                                                                                                             | Призначення                                                                     |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| /admin/marketplaces (+ /audit /buyer /categories /disputes /help /pick-list /pricing-parity /repricing /returns) | OLX/Rozetka/Prom/Epicentr: синк, спори, комплектування, переоцінка, паритет цін |
| /admin/feeds                                                                                                     | Продуктові фіди                                                                 |
| /admin/integrations                                                                                              | API-інтеграції                                                                  |
| /admin/webhooks                                                                                                  | Webhooks                                                                        |

### Соцмережі (SMM)

| Роут                         | Призначення                          |
| ---------------------------- | ------------------------------------ |
| /admin/channels              | Статистика каналів                   |
| /admin/channel-settings      | Облікові записи TG/FB/IG/TikTok      |
| /admin/bot-settings          | Телеграм-бот + автопостинг           |
| /admin/publications          | Публікації (планування, мультиканал) |
| /admin/publication-templates | Шаблони публікацій                   |
| /admin/chat                  | Чат з клієнтами                      |
| /admin/google-business       | Google Business                      |
| /admin/moderation            | Модерація                            |

### Налаштування

| Роут                     | Призначення                       |
| ------------------------ | --------------------------------- |
| /admin/settings          | Загальні налаштування (+AI-ключі) |
| /admin/payment-settings  | Платіжні провайдери (шифровано)   |
| /admin/delivery-settings | Доставка                          |
| /admin/smtp-settings     | SMTP                              |
| /admin/seo-templates     | SEO-шаблони мета                  |
| /admin/seo-audit         | SEO-аудит                         |
| /admin/not-found-log     | Лог 404                           |
| /admin/domains           | Домени                            |
| /admin/setup-2fa         | 2FA (прихована з меню)            |

### Платформа (root-only)

| Роут                           | Призначення      |
| ------------------------------ | ---------------- |
| /admin/billing, /billing/plans | Білінг, тарифи   |
| /admin/tenants                 | Multi-tenant     |
| /admin/health                  | Здоров'я системи |
| /admin/audit-log               | Аудит дій        |
| /admin/feature-flags           | Фіч-флаги        |
| /admin/ask                     | AI-асистент      |

---

## 2. Секції головної сторінки (по порядку)

Файл: `src/app/[locale]/(shop)/page.tsx`. Порядок/увімкнення керується `SiteSetting.homepage_blocks` (адмінка /admin/homepage), дефолт — усі 8 блоків.

1. **BannerSlider** — слайдер банерів (самоховається, якщо банерів нема)
2. **CategoryGrid** — сітка категорій (якщо є категорії)
3. **ProductCarousel: Акції** (якщо є промо-товари)
4. **ProductCarousel: Новинки**
5. **ProductCarousel: Хіти продажів**
6. **SEO-текстовий блок** (контент з адмінки, якщо непорожній)
7. **RecentlyViewedSection** — нещодавно переглянуті (client-side, localStorage)

⚠️ Блок **brands** є в DEFAULT_BLOCKS, але компонент на сторінці НЕ рендериться — плейсхолдер/gap.

---

## 3. Стан SEO

### JSON-LD (12 типів)

WebSite + SearchAction, LocalBusiness/Organization (layout.tsx), Product + AggregateRating (ProductJsonLd, ReviewAggregateJsonLd), BreadcrumbList (Breadcrumbs.tsx), Article (BlogJsonLd), NewsArticle (news), FAQPage (FaqJsonLd — /faq та товари з FAQ-розміткою в описі), HowTo (блог), CollectionPage/ItemList (catalog, blog), LocalBusiness (contacts).

### Sitemap

`src/app/sitemap.ts` (force-dynamic, live DB) + чанки товарів `/sitemap-products/[chunk]` по 5000. Включає: статичні сторінки, товари, категорії, бренди, інфо-сторінки, блог + категорії блогу, бандли. Усе з lastModified та hreflang.

### Robots

`src/app/robots.ts`: Disallow /api/, /admin/, /account, /auth/, /checkout/, /cart/, /comparison; Sitemap-лінк є.

### Canonical / hreflang

- canonical через `alternates.canonical` на всіх публічних сторінках; cart/account/auth — без явного (мають noindex — норм).
- hreflang: `buildHreflang()` (uk дефолт, en, x-default) — на всіх основних сторінках і в sitemap.
- Глибока пагінація → noindex,follow; пошукові параметри → noindex. ОК.

### OG / Twitter

- openGraph+twitter (`summary_large_image`) скрізь; продукт — кастомний `ProductOgProperty` (`property=` для product:price/availability) + динамічна OG-картинка `/api/og`; блог — обкладинка поста; бренд — лого.
- Дефолтна OG: `src/app/opengraph-image.tsx` (1200×630, next/og).

### Feeds (6)

| Фід             | Роут                       | Формат                          |
| --------------- | -------------------------- | ------------------------------- |
| RSS товари (50) | /feed.xml                  | RSS 2.0                         |
| RSS блог        | /blog/feed.xml             | RSS 2.0 + enclosure             |
| Google Shopping | /feed/google-shopping      | RSS + g: ns (gtin/mpn/shipping) |
| Prom            | /api/v1/feeds/prom.xml     | YML, ISR 30 хв                  |
| Epicentr        | /api/v1/feeds/epicentr.xml | YML, ISR 30 хв                  |
| Hotline         | /api/v1/feeds/hotline.xml  | Hotline XML, ISR 30 хв          |

### IndexNow

`src/services/indexnow.ts` + `/indexnow-key.txt`; авто-пінг при створенні/оновленні товару (Bing/Yandex/Seznam/Naver). Production-only, потребує `INDEXNOW_KEY`.

### Неповноти (мінорні)

1. Блок brands на головній не рендериться (gap, див. §2).
2. Product FAQ JSON-LD працює лише якщо опис містить `<h3>Питання та відповіді</h3>`.
3. Категорії блогу в sitemap — потенційно thin content.

Загалом: SEO-інфраструктура повна, відповідає попереднім аудитам (2026-06-06…09). Головний важіль — зовнішні сигнали + час (молодий домен).

---

## 4. Модуль SMM — Є (частково), з конкретними gap'ами

### Є

- **Автопостинг Telegram** (`src/services/jobs/promo-autopost.ts` + cron щогодини): промо + новинки, розклад по годинах Києва, batchSize 1–20, Redis-дедуп 30 днів, UTM-мітки. UI: /admin/bot-settings.
- **Публікації (мультиканал)**: моделі Publication/PublicationChannel/PublicationImage; UI /admin/publications: планування (scheduledAt + cron), канали telegram/facebook/instagram/tiktok/+маркетплейси, per-channel контент, перший коментар IG, retry, синк insights.
- **Шаблони публікацій** (/admin/publication-templates) з `{{product.*}}` плейсхолдерами.
- **Канали**: конфіг TG/FB/IG/TikTok у DB (шифровані токени), тест з'єднання; /admin/channels — статистика.
- **AI-генерація**: `src/services/ai-content.ts` (Claude/Gemini/rules) — але ТІЛЬКИ для товарів/категорій/блогу/alt-текстів.

### Gaps (нема)

1. **Автопостинг у Facebook/Instagram** — лише ручні публікації (autopost тільки Telegram).
2. **Контент-план / календар** — нема calendar-view із drag&drop, лише список із scheduledAt.
3. **AI-генерація соцпостів/хаштегів** — ai-content не підключений до publications (нема `/publications/ai-generate`).
4. TikTok — конфіг є, публішингу в коді нема.
5. SMM-аналітика — views/clicks/engagement пишуться в DB, але dashboard ROI нема.
