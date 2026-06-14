# 14. REST API — довідник

Pulito надає версіоноване REST API під базовим шляхом **`/api/v1`**. Це той самий API, що його споживає фронтенд (вітрина + адмінка через `apiClient`), а також зовнішні інтеграції (1С/BAS, маркетплейси, платіжні провайдери). У дереві маршрутів `src/app/api/v1/` живе понад **500 route-handler-ів** (файли `route.ts`), згрупованих за ресурсами.

Цей розділ описує загальні домовленості (формат відповідей, автентифікація, версіонування, пагінація, помилки, спільні обгортки), а далі — таблиці основних ендпоінтів по групах. За деталями безпеки (JWT, ролі, rate limiting, CSRF, CSP) див. [15. Безпека](15-безпека.md).

---

## 1. Огляд

| Параметр       | Значення                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Базовий шлях   | `/api/v1`                                                                                                                  |
| Транспорт      | HTTPS (за Cloudflare у проді)                                                                                              |
| Формат тіла    | `application/json` (плюс `multipart/form-data` для завантажень, `application/x-www-form-urlencoded` для вебхуків платіжок) |
| Версіонування  | URL-сегмент `v1` + заголовки `API-Version: 1` / `X-API-Version: 1`                                                         |
| Автентифікація | JWT: httpOnly-cookie `refresh_token` + `Authorization: Bearer <access_token>`                                              |
| Документація   | Swagger UI: `GET /api-docs` (читає `/openapi.json`)                                                                        |
| Runtime        | Next.js 16 App Router, Node.js runtime (не Edge для більшості)                                                             |

Технічна оболонка кожного маршруту складається з трьох спільних шарів:

1. **Edge/proxy шар** — `src/proxy.ts` (CSRF, in-memory rate-limit, заголовки безпеки, IP-вайтлист адмінки, maintenance).
2. **Обгортки маршруту** — `createApiHandler` (Redis rate-limit) + `withAuth`/`withOptionalAuth`/`withRole`/`withRole2fa`/`withApiKey`.
3. **Хендлер** — Zod-валідація → сервіс → `successResponse`/`errorResponse`.

---

## 2. Формат відповідей

Всі JSON-відповіді мають уніфіковану обгортку (`src/utils/api-response.ts`).

**Успіх:**

```json
{ "success": true, "data": { ... } }
```

**Помилка:**

```json
{ "success": false, "error": "Текст помилки українською" }
```

**Пагінований список:**

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 }
}
```

Хелпери:

| Функція                                       | Призначення                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| `successResponse(data, status=200)`           | стандартна успішна відповідь                                                         |
| `privateResponse(data)`                       | те саме + `Cache-Control: no-store` (для per-user даних: профіль, кошик, замовлення) |
| `paginatedResponse(data, total, page, limit)` | публічний пагінований список                                                         |
| `privatePaginatedResponse(...)`               | пагінований + `no-store`                                                             |
| `errorResponse(error, status=400)`            | помилка                                                                              |
| `parseSearchParams(searchParams)`             | парсить `page`/`limit`/`sortBy`/`sortOrder`/`search` з безпечними дефолтами          |

---

## 3. Автентифікація

Деталі — у [15. Безпека](15-безпека.md). Коротко:

- **Access-token** — короткоживучий JWT (`JWT_ACCESS_TTL`, типово 15 хв). Передається у заголовку `Authorization: Bearer <token>`. Перевіряється обгорткою `withAuth` (`src/middleware/auth.ts`).
- **Refresh-token** — довгоживучий JWT (`JWT_REFRESH_TTL`, типово 30 днів) у **httpOnly cookie** `refresh_token` (`Secure`, `SameSite=Lax`). Зберігається хешованим у таблиці `RefreshToken` з ротацією та reuse-detection.
- **2FA** — якщо ввімкнено TOTP, `/auth/login` повертає `tempToken` (тип `2fa`, TTL 5 хв) замість пари токенів; завершення через `/auth/2fa/verify-login`.
- **API-ключі** — для 1С/BAS-інтеграції (`Authorization: Bearer csk_…` або `X-API-Key`), перевіряються `withApiKey` проти таблиці `ApiKey`.
- **CRON_SECRET** — для cron-ендпоінтів (`Authorization: Bearer <CRON_SECRET|APP_SECRET>`).

Приклад автентифікованого запиту:

```bash
curl https://pulito.trade/api/v1/me/account \
  -H "Authorization: Bearer eyJhbGciOi..." \
  -H "X-Requested-With: XMLHttpRequest"
```

---

## 4. Версіонування

- Версія зашита в URL: `/api/v1/...`. Майбутні несумісні зміни підуть у `/api/v2`.
- Хелпери `addApiVersionHeaders` / `addDeprecationHeaders` (`src/middleware/api-version.ts`) додають `API-Version`, `X-API-Version`, а для застарілих маршрутів — `Deprecation: true`, `Sunset: <date>`, `Link: <...>; rel="successor-version"`.

---

## 5. Swagger / OpenAPI

- **UI:** `GET /api-docs` — Swagger UI (`src/app/api-docs/route.ts`), що тягне `/openapi.json`.
- **Специфікація:** `public/openapi.json` генерується скриптом `scripts/generate-openapi.ts`:
  - бере вручну задокументовані ендпоінти з `src/lib/swagger.ts` (схеми тіл генеруються з тих самих Zod-валідаторів через `z.toJSONSchema()`);
  - авто-сканує всі `route.ts` під `api/v1`, визначає експортовані методи (`GET/POST/PUT/PATCH/DELETE`), теги та path-параметри;
  - **cron-ендпоінти виключаються** з публічної документації.

```bash
npx tsx scripts/generate-openapi.ts   # → public/openapi.json
```

---

## 6. Спільні механізми

### 6.1 Обгортка `createApiHandler`

`src/lib/api-handler.ts` — другий рівень захисту (після in-memory Edge-rate-limit у `proxy.ts`): Redis sliding-window per-IP. Додає `X-RateLimit-Limit` / `X-RateLimit-Remaining`, повертає `429` з `Retry-After`. Може обгортати і автентифіковані хендлери:

```ts
export const POST = createApiHandler(
  RATE_LIMITS.orders,
  withOptionalAuth(async (request, { user }) => {
    /* ... */
  }),
);
```

### 6.2 Валідація (Zod)

Кожен мутуючий ендпоінт парсить тіло/query через Zod-схему з `src/validators/*` (`auth`, `order`, `payment`, `delivery`, `coupon`, `product`, `category`, `loyalty`, `nova-poshta`, `integration-1c` тощо). Помилка валідації → `422` (або `400`) з першим повідомленням:

```ts
const parsed = checkoutSchema.safeParse(body);
if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);
```

### 6.3 Rate limiting

- **Edge (proxy.ts):** per-route in-memory ліміт для всіх `/api/*`.
- **Redis (route handlers):** sliding-window через `checkRateLimit` + пресети `RATE_LIMITS` (`src/services/rate-limit.ts`): `auth` 10/хв, `api` 60/хв, `sensitive` 3/15хв, `orders` 10/хв, `search` 30/хв, `couponValidate` 20/5хв, `integration1c` 100/хв, `publicDelivery` 30/хв і десятки інших.
- **Логін:** окремий лічильник `checkLoginRateLimit` — 5 спроб / 15 хв на `IP:email`.
- При вичерпанні — `429` + `Retry-After`. Redis недоступний → fail-open (запит дозволяється, JWT досі захищає).

### 6.4 Idempotency

Створення замовлення приймає заголовок **`X-Idempotency-Key`** (`src/services/idempotency.ts`):

- `reserveIdempotencyKey` атомарно (`SET NX`) резервує ключ;
- дубль під час обробки → `409` («Замовлення вже опрацьовується»);
- дубль після завершення → повертається закешована відповідь (`201`);
- TTL відповіді — 24 год, in-flight маркер — 60 с.

```bash
curl -X POST https://pulito.trade/api/v1/orders \
  -H "Authorization: Bearer <token>" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "X-Idempotency-Key: 9f1c-checkout-2026-06-14-abc" \
  -d '{ "deliveryMethod": "np_warehouse", ... }'
```

### 6.5 Пагінація

Query-параметри `page` (≥1, дефолт 1) та `limit` (1–100, дефолт 20), плюс `sortBy`, `sortOrder` (`asc`/`desc`), `search`. Відповідь — об'єкт `pagination` (див. §2).

### 6.6 Обробка помилок

| Статус | Коли                                                                           |
| ------ | ------------------------------------------------------------------------------ |
| `400`  | загальна помилка валідації/бізнес-логіки                                       |
| `401`  | немає/невалідний/відкликаний токен                                             |
| `403`  | недостатньо прав, IP поза вайтлистом, заблокований акаунт, невдала CSRF/підпис |
| `404`  | ресурс не знайдено                                                             |
| `409`  | конфлікт (idempotency in-flight, дубль email, race)                            |
| `413`  | надто велике тіло (вебхуки)                                                    |
| `422`  | помилка Zod-валідації тіла                                                     |
| `429`  | перевищено rate-limit                                                          |
| `500`  | внутрішня помилка                                                              |

Хендлери ловлять винятки і повертають уніфікований `errorResponse('Внутрішня помилка сервера', 500)`, не розкриваючи стек.

### 6.7 CORS / CSRF

API призначений для same-origin споживання. Мутуючі запити (`POST/PUT/PATCH/DELETE`) проходять CSRF-перевірку в `proxy.ts`: `Origin`/`Referer` мають збігатися з довіреним хостом **та** має бути заголовок `X-Requested-With`. Виключення: вебхуки, cron, `/metrics`, `/events`, `/log-client-error`.

---

## 7. Групи ендпоінтів

> Нижче — основні маршрути. Шляхи відносні до `/api/v1`. Динамічні сегменти у фігурних дужках (`{id}`, `{slug}`).

### 7.1 Auth — автентифікація (`/auth`)

| Метод | Шлях                     | Призначення                                   |
| ----- | ------------------------ | --------------------------------------------- |
| POST  | `/auth/register`         | реєстрація (email/пароль), видає пару токенів |
| POST  | `/auth/login`            | вхід; повертає токени або `tempToken` для 2FA |
| POST  | `/auth/logout`           | вихід (blacklist access + revoke refresh)     |
| POST  | `/auth/refresh`          | ротація токенів за refresh-cookie             |
| GET   | `/auth/me`               | поточний користувач за access-токеном         |
| POST  | `/auth/forgot-password`  | надіслати лист скидання пароля                |
| POST  | `/auth/reset-password`   | скинути пароль за токеном                     |
| POST  | `/auth/verify-email`     | підтвердити email                             |
| GET   | `/auth/google`           | старт Google OAuth                            |
| GET   | `/auth/google/callback`  | колбек Google OAuth                           |
| POST  | `/auth/2fa/setup`        | згенерувати TOTP-секрет + backup-коди         |
| POST  | `/auth/2fa/verify`       | підтвердити та увімкнути 2FA                  |
| POST  | `/auth/2fa/verify-login` | завершити вхід кодом 2FA                      |
| POST  | `/auth/2fa/disable`      | вимкнути 2FA                                  |

### 7.2 Me — особистий кабінет (`/me`)

| Метод    | Шлях                                                                                                            | Призначення                       |
| -------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| GET/PUT  | `/me/account`                                                                                                   | профіль користувача               |
| GET/POST | `/me/addresses`, `/me/addresses/{id}`                                                                           | адреси доставки                   |
| GET      | `/me/loyalty`, `/me/loyalty/transactions`, `/me/loyalty/streak`, `/me/loyalty/challenges`                       | лояльність / бали                 |
| GET/POST | `/me/wishlists`, `/me/wishlists/{id}`, `.../items`, `.../items/bulk`                                            | списки бажань                     |
| GET      | `/me/notifications`, `/me/notifications/count`, `/me/notifications/stream` (SSE), `/me/notifications/{id}/read` | сповіщення                        |
| GET/PUT  | `/me/notification-preferences`                                                                                  | налаштування сповіщень            |
| GET/POST | `/me/subscriptions`, `/me/subscriptions/{id}`                                                                   | підписки на товари                |
| GET      | `/me/returns`                                                                                                   | повернення                        |
| GET      | `/me/referral`                                                                                                  | реферальна програма               |
| GET      | `/me/login-history`                                                                                             | історія входів                    |
| GET      | `/me/gdpr-export`, `/me/export`                                                                                 | експорт персональних даних (GDPR) |
| GET/POST | `/me/wholesale-request`, `/me/wholesale-stats`                                                                  | заявка/статистика гурту           |
| GET      | `/me/predictions`, `/me/recently-viewed`, `/me/search-history`, `/me/notes`                                     | персоналізація                    |
| POST     | `/me/telegram-link`                                                                                             | прив'язка Telegram                |

### 7.3 Каталог — products / categories / brands

| Метод | Шлях                                                                                              | Призначення                         |
| ----- | ------------------------------------------------------------------------------------------------- | ----------------------------------- |
| GET   | `/products`                                                                                       | список товарів (фільтри, пагінація) |
| GET   | `/products/{slug}`                                                                                | картка товару                       |
| GET   | `/products/search`                                                                                | повнотекстовий пошук                |
| GET   | `/products/instant-search`                                                                        | autocomplete                        |
| GET   | `/products/by-ids`                                                                                | пакетне отримання за ID             |
| GET   | `/products/new`, `/products/popular`, `/products/promo`                                           | добірки                             |
| POST  | `/products/back-in-stock`                                                                         | підписка «повідомити про наявність» |
| GET   | `/products/{slug}/reviews`, `.../recommendations`, `.../price-history`, `.../marketplace-reviews` | під-ресурси товару                  |
| GET   | `/categories`, `/categories/{slug}`                                                               | категорії                           |
| GET   | `/banners`, `/theme`                                                                              | банери, активна тема                |

### 7.4 Кошик і оформлення — cart / checkout / orders

| Метод           | Шлях                                      | Призначення                                         |
| --------------- | ----------------------------------------- | --------------------------------------------------- |
| GET/POST/DELETE | `/cart`, `/cart/{productId}`              | кошик                                               |
| POST            | `/cart/validate`                          | перевірка кошика перед оформленням                  |
| GET             | `/checkout/config`                        | конфіг оформлення (методи доставки/оплати)          |
| GET             | `/orders`                                 | список замовлень користувача                        |
| POST            | `/orders`                                 | створити замовлення (підтримує `X-Idempotency-Key`) |
| GET             | `/orders/{id}`                            | деталі замовлення                                   |
| POST            | `/orders/{id}/pay`                        | ініціювати оплату                                   |
| GET             | `/orders/{id}/invoice`, `/orders/{id}/qr` | рахунок, QR                                         |
| GET             | `/orders/{id}/status`                     | статус                                              |
| POST            | `/orders/{id}/reorder`                    | повторити замовлення                                |
| GET             | `/orders/frequent-products`               | часто замовлювані товари                            |
| POST            | `/quick-order`                            | швидке замовлення (1 клік / телефон)                |
| POST            | `/reorder/{orderId}`                      | відновити кошик зі старого замовлення               |
| GET             | `/track/{orderNumber}`                    | публічне відстеження за номером                     |

### 7.5 Знижки — coupons / wholesale / volume-discounts / bundles

| Метод    | Шлях                                                                            | Призначення                             |
| -------- | ------------------------------------------------------------------------------- | --------------------------------------- |
| POST     | `/coupons/validate`                                                             | перевірка промокоду (rate-limit 20/5хв) |
| GET      | `/volume-discounts`                                                             | знижки за обсягом                       |
| GET      | `/wholesale-rules`                                                              | правила гуртових цін                    |
| POST     | `/wholesale/bulk-order`                                                         | гуртове замовлення (форма)              |
| POST     | `/wholesale/commercial-proposal`                                                | PDF-комерпропозиція                     |
| GET/POST | `/bundles`, `/bundles/{slug}`, `/bundles/detect`, `/bundles/{slug}/add-to-cart` | бандли (набори)                         |
| GET      | `/pricelist`, `/pricelist/meta`                                                 | PDF-прайс                               |

### 7.6 Доставка (`/delivery`)

| Метод | Шлях                                                            | Призначення                         |
| ----- | --------------------------------------------------------------- | ----------------------------------- |
| GET   | `/delivery/cities`, `/delivery/streets`, `/delivery/warehouses` | Нова Пошта: міста/вулиці/відділення |
| GET   | `/delivery/ukrposhta-cities`, `/delivery/ukrposhta-warehouses`  | Укрпошта                            |
| POST  | `/delivery/estimate`                                            | оцінка вартості/строку доставки     |
| GET   | `/delivery/tracking`                                            | трекінг ТТН                         |
| GET   | `/delivery/delivery-date`                                       | очікувана дата                      |
| POST  | `/delivery/pallet/calculate`                                    | розрахунок палетної доставки        |

> Усі публічні delivery-ендпоінти під пресетом `publicDelivery` (30/хв) — захист upstream-квоти Нової Пошти.

### 7.7 Контент і взаємодія — reviews / blog / faq / pages / feedback / chat

| Метод    | Шлях                                                                            | Призначення                             |
| -------- | ------------------------------------------------------------------------------- | --------------------------------------- |
| POST     | `/reviews/upload`, `/reviews/{id}/images`                                       | відгуки + фото                          |
| POST     | `/reviews/{id}/helpful`                                                         | «корисний» відгук                       |
| GET      | `/blog`, `/blog/{slug}`, `/blog/comments`                                       | блог                                    |
| GET      | `/faq`, `/faq/search`, `/faq/{id}/click`                                        | FAQ                                     |
| GET      | `/pages`, `/pages/{slug}`                                                       | статичні сторінки                       |
| POST     | `/feedback`, `/callback-request`                                                | зворотний зв'язок / зворотний дзвінок   |
| GET/POST | `/chat`, `/chat/{roomId}`, `/chat/{roomId}/read`, `/chat/{roomId}/stream` (SSE) | онлайн-чат                              |
| POST     | `/chatbot/query`                                                                | запит до чат-бота                       |
| GET      | `/recommendations`, `/recommendations/cart`                                     | рекомендації                            |
| POST     | `/subscribe`                                                                    | підписка на розсилку (sensitive 3/15хв) |

### 7.8 Push, аналітика, службові

| Метод | Шлях                                   | Призначення                             |
| ----- | -------------------------------------- | --------------------------------------- |
| POST  | `/push/subscribe`, `/push/unsubscribe` | web-push підписки                       |
| POST  | `/events`                              | трекінг подій (sendBeacon, CSRF-exempt) |
| POST  | `/metrics`                             | метрики продуктивності (CSRF-exempt)    |
| POST  | `/log-404`, `/log-client-error`        | діагностичні маяки                      |
| POST  | `/cookie-consent`                      | згода на cookies (GDPR)                 |
| GET   | `/feature-flags/check`                 | перевірка feature-flag                  |
| GET   | `/health`                              | health-check (БД/Redis/залежності)      |
| GET   | `/ping`                                | liveness-проба                          |

### 7.9 Стрічки / фіди (`/feeds`)

| Метод | Шлях                  | Призначення          |
| ----- | --------------------- | -------------------- |
| GET   | `/feeds/prom.xml`     | YML-фід для Prom     |
| GET   | `/feeds/epicentr.xml` | YML-фід для Epicentr |
| GET   | `/feeds/hotline.xml`  | фід для Hotline      |

> Інші фіди (Google Shopping, RSS блогу, sitemap) живуть поза `/api/v1` — на корені застосунку.

### 7.10 Інтеграція 1С/BAS (`/integration/1c`)

| Метод    | Шлях                       | Призначення                       |
| -------- | -------------------------- | --------------------------------- |
| GET/POST | `/integration/1c/products` | вивантаження/завантаження товарів |
| POST     | `/integration/1c/prices`   | оновлення цін                     |
| POST     | `/integration/1c/stock`    | оновлення залишків                |
| GET      | `/integration/1c/orders`   | вивантаження замовлень            |

> Захищені `withApiKey` (ключ `csk_…`, таблиця `ApiKey`, перевірка permissions + per-key rate-limit `integration1c` 100/хв).

### 7.11 Адмінка (`/admin`) — оглядово

Близько половини всіх маршрутів — під `/admin/*` (понад 250 файлів). Захищені `withRole('admin')` / `withRole('manager','admin')`, чутливі — `withRole2fa`. Доступ додатково обмежується IP-вайтлистом (`ADMIN_ALLOWED_IPS`). Основні підгрупи:

| Підгрупа       | Приклади шляхів                                                                                                                                                           | Призначення                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Каталог        | `/admin/products`, `/admin/products/{id}`, `/admin/categories`, `/admin/brands`, `/admin/tags`, `/admin/badges`                                                           | CRUD товарів/категорій             |
| Замовлення     | `/admin/orders`, `/admin/orders/{id}`, `/admin/orders/board`, `/admin/orders/{id}/ttn`, `/admin/orders/{id}/refund`                                                       | обробка замовлень, ТТН, повернення |
| Аналітика      | `/admin/analytics/*` (profit, ltv, rfm, cohorts, abc, funnel, geography, churn, performance)                                                                              | бізнес-аналітика                   |
| Маркетинг      | `/admin/campaigns`, `/admin/coupons`, `/admin/banners`, `/admin/publications`, `/admin/loyalty/*`, `/admin/referrals`                                                     | акції, лояльність                  |
| Маркетплейси   | `/admin/marketplaces/*` (OLX/Rozetka/Prom: cross-list, messages, reviews, repricing, disputes)                                                                            | мультиканальний продаж             |
| Постачальники  | `/admin/supplier-channels/*`, `/admin/import/*`                                                                                                                           | консигнація/дропшип, імпорт фідів  |
| Склад          | `/admin/warehouses`, `/admin/warehouse-transfers`, `/admin/stock-counts`, `/admin/pallets`                                                                                | логістика                          |
| Налаштування   | `/admin/settings`, `/admin/payment-settings`, `/admin/smtp-settings`, `/admin/channel-settings`, `/admin/delivery-settings`, `/admin/feature-flags`, `/admin/maintenance` | конфігурація                       |
| Безпека/доступ | `/admin/users`, `/admin/users/{id}/impersonate`, `/admin/users/{id}/security`, `/admin/audit-log`, `/admin/webhooks`, `/admin/integration/api-keys`                       | користувачі, аудит, ключі          |
| Контент/SEO    | `/admin/blog`, `/admin/pages`, `/admin/faq`, `/admin/seo-templates`, `/admin/email-templates`                                                                             | контент                            |
| Білінг (SaaS)  | `/admin/billing/*`, `/admin/tenants/*`, `/admin/plans`, `/admin/domains/*`                                                                                                | мульти-тенант                      |

---

## 8. Cron-ендпоінти (`/api/v1/cron/*`)

Близько **60 cron-маршрутів** — внутрішні фонові задачі, **виключені з публічної OpenAPI**. Кожен захищений секретом: заголовок `Authorization: Bearer <CRON_SECRET>` (з фолбеком на `APP_SECRET`), перевірка через `timingSafeCompare` (`src/utils/timing-safe.ts`). Викликаються лише з localhost через `/home/pulitotrade/cron-run.sh` (POST на `http://localhost:3000/api/v1/cron/<route>`, щоб Cloudflare не блокував server-to-server).

```bash
# cron-run.sh читає CRON_SECRET з .env, не з crontab
./cron-run.sh cleanup-tokens
./cron-run.sh safety-stock-alert "threshold=5"
```

Приклади cron-задач за призначенням:

| Категорія        | Маршрути                                                                                                                                                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Замовлення/кошик | `auto-cancel`, `cleanup-carts`, `abandoned-carts`, `cart-recovery`, `auto-tracking`                                                                                                                                                                                                                                 |
| Лояльність       | `loyalty-daily`, `expire-loyalty`                                                                                                                                                                                                                                                                                   |
| Маркетинг/email  | `email-campaigns`, `email-sequences`, `win-back`, `back-in-stock`, `campaigns`, `promo-autopost`, `publications`, `publish-scheduled`                                                                                                                                                                               |
| Маркетплейси     | `sync-marketplace-prices`, `sync-marketplace-stock`, `sync-marketplace-orders`, `sync-marketplace-messages`, `import-marketplace-reviews`, `marketplace-health-check`, `marketplace-token-refresh`, `marketplace-auto-crosslist`                                                                                    |
| Постачальники    | `sync-supplier-channels`, `price-sync`                                                                                                                                                                                                                                                                              |
| Аналітика/звіти  | `precompute-analytics`, `analytics-digest`, `analytics-alerts`, `weekly-report`, `dispatch-reports`, `daily-briefing`, `funnel-aggregate`                                                                                                                                                                           |
| Підписки         | `process-subscriptions`, `subscription-reminders`                                                                                                                                                                                                                                                                   |
| SEO/контент      | `generate-product-seo`, `generate-category-seo`, `seo-check`, `reindex-products`, `build-recommendations`, `classify-reviews`, `predictions`                                                                                                                                                                        |
| Обслуговування   | `cleanup-tokens`, `cleanup-audit-log`, `cleanup-webhook-logs`, `cleanup-soft-deleted`, `cleanup-not-found-logs`, `cleanup-stuck-integration-syncs`, `purge-archived-listings`, `partition-rotate`, `db-backup`, `health-check`, `payment-reconciliation`, `safety-stock-alert`, `auto-badges`, `auto-archive-stale` |

> Cron-задачі, що не повинні перетинатися (синки маркетплейсів), беруть Redis-лок через `withCronLock` (**fail-closed**: якщо Redis недоступний — пропуск запуску, аби уникнути подвійного виконання).

---

## 9. Вебхуки

### 9.1 Вхідні (`/api/webhooks/*`)

Зовнішні провайдери POST-ять сюди; маршрути **поза** `/api/v1` і **виключені з CSRF**.

| Шлях                                    | Джерело         | Перевірка                              |
| --------------------------------------- | --------------- | -------------------------------------- |
| `/api/webhooks/liqpay`                  | LiqPay          | підпис (HMAC), 401 при невідповідності |
| `/api/webhooks/monobank`                | Monobank        | підпис                                 |
| `/api/webhooks/wayforpay`               | WayForPay       | підпис                                 |
| `/api/webhooks/telegram`                | Telegram Bot    | секретний шлях/токен                   |
| `/api/webhooks/marketplaces/{platform}` | OLX/Rozetka/... | per-platform                           |

Спільні захисти: per-IP rate-limit (`checkWebhookRateLimit`), ліміт розміру тіла (напр. 64 КБ для платіжок → `413`), логування в `WebhookLog`. Невдала перевірка підпису → `401` (щоб успішна підробка не відрізнялась від будь-якої іншої відмови та ловилась моніторингом).

### 9.2 Вихідні (`WebhookSubscription`)

Адмін може зареєструвати власні вебхуки (`/admin/webhooks`): модель `WebhookSubscription` (`url`, `secret`, `events[]`, `isActive`), доставки логуються в `WebhookDelivery` (`statusCode`, `attempt`, `durationMs`, `error`) з ретраями (`/admin/webhooks/deliveries/{id}/retry`).

---

## Файли-орієнтири

| Файл                                                | Призначення                                            |
| --------------------------------------------------- | ------------------------------------------------------ |
| `src/app/api/v1/**/route.ts`                        | усі route-handler-и (~516)                             |
| `src/lib/api-handler.ts`                            | `createApiHandler` (Redis rate-limit)                  |
| `src/middleware/auth.ts`                            | `withAuth`/`withOptionalAuth`/`withRole`/`withRole2fa` |
| `src/middleware/api-key-auth.ts`                    | `withApiKey` (1С/BAS)                                  |
| `src/middleware/api-version.ts`                     | заголовки версіонування                                |
| `src/services/rate-limit.ts`                        | пресети `RATE_LIMITS` + sliding-window                 |
| `src/services/idempotency.ts`                       | idempotency для замовлень                              |
| `src/utils/api-response.ts`                         | хелпери відповідей/пагінації                           |
| `src/lib/swagger.ts`, `scripts/generate-openapi.ts` | OpenAPI                                                |
| `src/app/api-docs/route.ts`                         | Swagger UI                                             |
| `/home/pulitotrade/cron-run.sh`                     | запуск cron-маршрутів                                  |

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
- **REST API** _(цей розділ)_
- [Безпека](15-безпека.md)
- [SEO та маркетинг](16-seo-маркетинг.md)
- [Аналітика та звіти](17-аналітика-звіти.md)
- [Multi-tenancy / SaaS](18-multi-tenancy.md)
- [Деплой та експлуатація](19-деплой-операції.md)
- [Тестування](20-тестування.md)

← Повернутись до [змісту документації](README.md)
