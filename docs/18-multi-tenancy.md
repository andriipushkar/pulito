# 18. Multi-tenancy / SaaS

Pulito спроєктовано як **multi-tenant SaaS**: одна кодова база обслуговує багато магазинів-орендарів (tenants), кожен зі своїм субдоменом або кастомним доменом, тарифним планом, білінгом, feature-flags та white-label-темою. Цей розділ описує:

1. **Tenant-ізоляцію** (`tenantId`, резолв орендаря з запиту, scoping Prisma).
2. **Routing** — субдомени та кастомні домени (DNS verify + auto SSL).
3. **Тарифні плани та білінг** (плани, інвойси, usage metering, proration).
4. **Управління тенантами/користувачами** та ролі.
5. **Feature flags** і **теми / white-label**.

Основні файли:

```
src/lib/tenant.ts
src/lib/prisma-tenant.ts
src/lib/admin-tenant.ts
src/services/tenant.ts
src/services/domain.ts
src/services/billing.ts
src/services/feature-flag.ts
src/services/theme.ts
prisma/schema/tenant.prisma
prisma/schema/billing.prisma
```

---

## Tenant-ізоляція та routing

### Резолв орендаря з запиту

`src/lib/tenant.ts`:

| Функція                     | Опис                                   |
| --------------------------- | -------------------------------------- |
| `getTenantFromRequest()`    | резолвить tenant за hostname           |
| `getTenantBySlug(slug)`     | пошук за slug (Redis-cache, TTL ~5 хв) |
| `getTenantByDomain(domain)` | пошук за кастомним доменом (cache)     |

**Порядок резолву** в `getTenantFromRequest()`:

1. Субдомен `{slug}.{baseDomain}` → резолв за slug.
2. Кастомний домен (повний hostname) → резолв за `domain`.
3. Немає збігу → `null` (default / single-tenant режим).

Базовий домен витягується з `APP_URL`.

### Scoping Prisma

`src/lib/prisma-tenant.ts` — `createTenantPrisma(tenantId)` повертає extension Prisma-клієнта, що авто-інʼєктить `tenantId` у запити.

Поетапне впровадження:

- **Фаза 1 (поточна):** схема існує; наявні моделі ще не мають `tenantId`; extension доступний, але не примусовий.
- **Фаза 2:** додати опційний `tenantId` до Product / Order / Category, backfill + увімкнути extension.
- **Фаза 3:** зробити `tenantId` обовʼязковим + увімкнути PostgreSQL Row Level Security (RLS).

### Резолв для адмінки

`src/lib/admin-tenant.ts` — `resolveActiveTenantId(request, userId)`:

1. tenant з host запиту (з перевіркою членства користувача);
2. якщо host немає → single-tenant fallback (якщо у користувача рівно одне членство);
3. ambiguous, якщо членств кілька, а запит не «пінить» жодне.

---

## Моделі тенантів

`prisma/schema/tenant.prisma`.

### Tenant

| Поле                                                           | Опис                 |
| -------------------------------------------------------------- | -------------------- |
| `id`, `name`                                                   | ідентифікатор, назва |
| `slug` (unique)                                                | для субдомену        |
| `domain` (unique), `domainVerified`, `domainVerificationToken` | кастомний домен      |
| `logoUrl`, `primaryColor`                                      | брендування          |
| `plan` (enum `TenantPlan`)                                     | тариф                |
| `isActive`, `settings` (JSON)                                  | стан + налаштування  |
| `createdAt`, `updatedAt`                                       | таймстемпи           |

Звʼязки: `users` (`TenantUser[]`), `billing` (`TenantBilling?`).

**Enum `TenantPlan`:** `free`, `basic`, `pro`, `enterprise`.

### TenantUser

| Поле                                 | Опис      |
| ------------------------------------ | --------- |
| `id`, `tenantId` (FK), `userId` (FK) | звʼязок   |
| `role` (enum `TenantUserRole`)       | роль      |
| `createdAt`                          | таймстемп |

Унікальність `@@unique([tenantId, userId])`; cascade-delete з обох боків.

**Enum `TenantUserRole`:** `owner`, `admin`, `member`.

---

## Управління тенантами

`src/services/tenant.ts`:

| Функція                                    | Опис                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| `createTenant(data)`                       | новий tenant (опційно settings)                                          |
| `getTenants(filters?)`                     | список; фільтри `plan`, `isActive`, `search` (name/slug/domain)          |
| `getTenantById(id)`                        | один tenant + кількість користувачів                                     |
| `updateTenant(id, data)`                   | оновлення + інвалідація кешу                                             |
| `deleteTenant(id, options?)`               | безпечне видалення (відмова, якщо є користувачі; `force: true` обходить) |
| `addUserToTenant(tenantId, userId, role?)` | додати користувача (default `member`)                                    |
| `removeUserFromTenant(tenantId, userId)`   | видалити користувача                                                     |
| `getTenantUsers(tenantId)`                 | список з даними (email, fullName, role, avatarUrl)                       |

Адмін-сторінки: `/admin/tenants` (CRUD + фільтри), `/admin/users` (глобальний список), `/admin/users/[id]` (деталі + членства).

---

## Кастомні домени

`src/services/domain.ts`:

| Функція                                        | Опис                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| `initiateDomainVerification(tenantId, domain)` | генерує токен; повертає імʼя TXT-запису                               |
| `verifyDomain(tenantId, domain)`               | DNS-перевірка (timeout 5 с); `domainVerified: true` + очищення токена |
| `mapDomain(tenantId, domain)`                  | підтвердження вже верифікованого домену (defensive)                   |
| `removeDomain(tenantId)`                       | очищення домену, прапора, токена                                      |
| `resolveTenantByDomain(domain)`                | хелпер для middleware (`tenantId` або `null`)                         |

**DNS-верифікація:**

- токен `clean-verify-{16-hex}`;
- TXT-запис `_clean-verify.{domain}`;
- DNS-lookup із 5-сек timeout (`Promise.race`), щоб не зависати на запит;
- формат домену валідовано regex.

Після верифікації — авто-SSL для домену. Адмін-сторінка `/admin/domains`: initiate → DNS verify → activate, та видалення домену.

---

## Тарифні плани та білінг

`prisma/schema/billing.prisma`.

### Моделі

| Модель             | Ключові поля                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Plan**           | `name`, `slug`, `priceMonthly` (Decimal 10,2), `priceYearly`, `features` (JSON), `maxProducts`, `maxOrders`, `isActive`               |
| **TenantBilling**  | `tenantId` (unique), `planId`, `status` (enum), `currentPeriodStart/End`, `trialEndsAt`, `proratedCredit` (Decimal), `invoiceCounter` |
| **BillingInvoice** | `billingId`, `invoiceNumber` (unique), `amount`, `proratedCredit`, `currency`, `status` (enum), `periodStart/End`, `paidAt`, `pdfUrl` |
| **UsageRecord**    | `tenantId`, `metric`, `value` (float), `recordedAt`                                                                                   |

**Enum `BillingStatus`:** `trial`, `active`, `past_due`, `cancelled`.
**Enum `InvoiceStatus`:** `draft`, `sent`, `paid`, `overdue`.

### Сервіс білінгу

`src/services/billing.ts`:

| Функція                                    | Опис                                                           |
| ------------------------------------------ | -------------------------------------------------------------- |
| `createBillingForTenant(tenantId, planId)` | створити білінг із 14-денним trial                             |
| `getBilling(tenantId)`                     | білінг + деталі плану                                          |
| `changePlan(tenantId, newPlanId)`          | зміна плану; рахує proration-кредит за невикористані дні       |
| `createInvoice(billingId)`                 | атомарно: інкремент лічильника → застосувати кредит → обнулити |
| `markInvoicePaid(invoiceId)`               | позначити оплаченим (з таймстемпом)                            |
| `checkUsageLimits(tenantId)`               | `{products: {used, max}, orders: {used, max}}`                 |
| `recordUsage(tenantId, metric, value)`     | лог події використання                                         |
| `getPlans()`                               | усі активні плани за ціною                                     |

**Proration:** при зміні плану посеред циклу кредит за невикористані дні = `(remaining_ms / total_ms) * oldPrice`; накопичується через кілька змін, застосовується до наступного інвойсу, потім обнуляється. Trial-періоди кредиту не генерують.

**Нумерація інвойсів (вимога України):** формат `INV-{counter}` (zero-padded 5 знаків, напр. `INV-00001`), per-tenant `invoiceCounter` гарантує послідовність без пропусків; інкремент атомарний у транзакції `createInvoice()`.

Адмін-сторінки: `/admin/billing` (статус, usage, інвойси), `/admin/billing/plans` (список планів + зміна з підтвердженням при downgrade).

### Три тарифи

`TenantPlan`: **free**, **basic**, **pro**, **enterprise** (плани зберігаються в моделі `Plan` з місячною/річною ціною та лімітами `maxProducts` / `maxOrders`; features — JSON).

---

## Feature flags

`src/services/feature-flag.ts` (модель `FeatureFlag`: `key` unique, `description`, `isEnabled`, `rolloutPercent` 0–100, `targetRoles[]`, `targetUserIds[]`):

| Функція                                     | Опис                                |
| ------------------------------------------- | ----------------------------------- |
| `getFlag(key)`                              | один флаг (Redis-cache → DB)        |
| `getAllFlags()`                             | усі флаги (cache)                   |
| `createFlag(data)`                          | новий флаг                          |
| `updateFlag(key, data)`                     | оновлення + інвалідація             |
| `deleteFlag(key)`                           | видалення + інвалідація             |
| `isFeatureEnabled(key, userId?, userRole?)` | перевірка для контексту користувача |

**Логіка `isFeatureEnabled`:**

1. `isEnabled: true` обовʼязково;
2. якщо `targetUserIds` непорожній → `userId` має бути в списку;
3. якщо `targetRoles` непорожній → `userRole` має бути в списку;
4. якщо `rolloutPercent < 100` → `hash(userId) % 100 < rolloutPercent` (стабільне бакетування).

Адмін-сторінка `/admin/feature-flags`: CRUD + rollout % + цільові ролі/користувачі.

---

## Теми та white-label

`src/services/theme.ts`. Три вбудовані теми:

| Назва                | Папка       | Primary   | Secondary | Опис                         |
| -------------------- | ----------- | --------- | --------- | ---------------------------- |
| Свіжість та Органіка | `freshness` | `#1565C0` | `#FFC107` | дефолтна, контраст WCAG AA   |
| Кристальна чистота   | `crystal`   | `#87CEEB` | `#FF8C42` | мінімалістична біло-блакитна |
| Домашній затишок     | `cozy`      | `#B39DDB` | `#F4A261` | тепла, «домашня» палітра     |

**Поля моделі теми:** `folderName` (unique), `displayName`, `description`, `version`, `author`, `previewImagePath`, `isActive`, `customSettings` (JSON), `installedAt`, `activatedAt`.

Кожна тема визначає ~17 CSS-змінних: `--color-primary*`, `--color-secondary`, `--radius`, `--shadow*`, `--transition-base`, статуси (danger/warning/success), стани (in-stock/out-of-stock).

| Функція                                        | Опис                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| `getActiveTheme()`                             | CSS-змінні активної теми (fallback — Freshness)                            |
| `getAllThemes()`                               | усі встановлені теми                                                       |
| `activateTheme(themeId)`                       | атомарно: деактивувати інші → активувати обрану                            |
| `updateThemeSettings(themeId, customSettings)` | оновити CSS-змінні (injection-safe; max 200 ключів, 500 симв.)             |
| `uploadTheme(buffer, filename)`                | встановити тему із ZIP: валідація `theme.json` → розпакування → збереження |

**White-label:** адмін обирає одну активну тему (`activateTheme`); клієнт рендериться з обʼєднанням `{baseTheme, ...customSettings}`. Підтримується завантаження кастомних тем у ZIP із `theme.json`. Адмін-сторінка `/admin/themes`: список, активація, upload, кастомізація змінних.

---

## Ключові архітектурні принципи

1. **Кешування:** Redis із TTL (~5 хв для tenant-lookups, короткий — для флагів).
2. **Soft-delete / стан:** запити фільтрують `isActive: true`.
3. **Атомарні транзакції:** proration, зміна плану, створення інвойсу — через `$transaction`.
4. **Гроші:** `Decimal(10,2)`, ніколи Float.
5. **Захист у глибину:** DNS-timeout, injection-перевірки CSS-тем, захист від path-traversal у ZIP.
6. **i18n:** повідомлення про помилки й UI — українською.

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
- [SEO та маркетинг](16-seo-маркетинг.md)
- [Аналітика та звіти](17-аналітика-звіти.md)
- **Multi-tenancy / SaaS** _(цей розділ)_
- [Деплой та експлуатація](19-деплой-операції.md)
- [Тестування](20-тестування.md)

← Повернутись до [змісту документації](README.md)
