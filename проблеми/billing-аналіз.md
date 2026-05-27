# Аналіз розділу «Білінг» (`/admin/billing`)

> Дата: 2026-05-26
> Сфера: `src/app/(admin)/admin/billing/page.tsx` (234), `plans/page.tsx` (138), `api/v1/admin/billing/{route,invoices,change-plan,webhook}.ts`, `services/billing.ts` (216), `services/subscription.ts`, `prisma/schema/billing.prisma`.
> Ролі: програміст, маркетолог, QA, користувач (власник тенанта/фінансист).

---

## ✅ Сильні сторони

- Webhook signature verification (HMAC) — є.
- Plan-change через сервісний `changePlan()` транзакційний.
- `checkUsageLimits()` enforce'ить ліміти (продукти, оператори).
- Auth-роль `withRole2fa('admin')` на всі mutation endpoints.
- Trial-period status у моделі — основа для нагадувань.

---

## 1. 👨‍💻 Як програміст — критичні

| #      | Тема                                                                                                                                                                                                             | Файл / рядок                                    | Severity                 |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------ |
| **B1** | **Tenant-isolation діра в `checkUsageLimits`**: `prisma.product.count()` глобально — рахує продукти ВСІХ тенантів. → tenant A може hit limit через дані tenant B, або обхід обмеження                            | `services/billing.ts:174`                       | 🔴 HIGH (multi-tenant)   |
| **B2** | **Invoice PDF URL відкритий**: `pdfUrl` віддається фронту без auth-check на тенант. Адмін tenant A знає invoice ID — може завантажити PDF tenant B                                                               | `billing/page.tsx:212-224`, `invoices/route.ts` | 🔴 HIGH (PII leak)       |
| **B3** | **Webhook без replay protection**: немає idempotency-key, timestamp валідації. Двократна доставка від провайдера → подвійна обробка (false duplicates у логах, не подвійні гроші завдяки `updateMany` atomicity) | `billing/webhook/route.ts:54-61`                | 🟠 HIGH                  |
| **B4** | **Plan-change race**: дві rapid кнопки upgrade → дві паралельні транзакції створення invoice. Транзакція в `changePlan` не серіалізує між собою                                                                  | `billing/change-plan/route.ts:9-38`             | 🟠 HIGH (фінансовий)     |
| **B5** | **Float для грошей** у Prisma schema. `10.005` стає `10.00` або `10.01` — audit/refund драмфт. Має бути `Decimal` (як ми зробили для payment)                                                                    | `prisma/schema/billing.prisma:8-9, 56`          | 🟠 HIGH (correctness)    |
| **B6** | **No proration** на mid-cycle upgrade: customer платить full monthly, без credit за невикористані дні. Обличчя tenant'а гірчить                                                                                  | `services/billing.ts:89-91`                     | 🟠 HIGH (UX + revenue)   |
| **B7** | **Plan downgrade без warning data-loss**: якщо новий план має `maxProducts=100`, а в тенанта 250 — invariant порушено мовчки                                                                                     | `plans/page.tsx:125-131`                        | 🟠 HIGH                  |
| **B8** | **No invoice numbering**: рахунки тримаються на auto-increment ID. Legal requirements багатьох юрисдикцій (UA — ст. 9 ЗУ «Про бухоблік») вимагають **gapless sequence per tenant**                               | `prisma/schema/billing.prisma:52-66`            | 🟠 MED-HIGH (compliance) |
| B9     | **Webhook fail-open if APP_SECRET unset**: ловить 503 замість 401 — у staging без env case attacker може отримати «accidentally accepted»                                                                        | `billing/webhook/route.ts:32-37`                | 🟡 MED                   |
| B10    | **No tenant defense-in-depth на invoices**: `billingId` резолвиться через tenant, але не перевіряється що `billing.tenantId === resolved.tenantId`                                                               | `invoices/route.ts:13-26`                       | 🟡 MED                   |
| B11    | **No invoice download endpoint** — фронт показує «Завантажити» але `pdfUrl` найчастіше null (генерація не імплементована)                                                                                        | `billing/page.tsx:174-176`                      | 🟡 MED UX                |
| B12    | **Plan prices hardcoded** у seed — без admin UI; для зміни ціни треба міграція                                                                                                                                   | `billing/page.tsx:135-136`                      | 🟡 MED                   |
| B13    | **Trial-to-paid state machine implicit** — webhook може arrive під час trial без явного переходу. Trial-billing invoice потенційно створиться                                                                    | `services/billing.ts:21-52`                     | 🟡 MED                   |
| B14    | **Webhook без rate-limit + IP whitelist** — public endpoint, лише HMAC. Якщо `APP_SECRET` ослаблено — brute-force                                                                                                | `billing/webhook/route.ts:18`                   | 🟢 LOW                   |
| B15    | **Trial-end warning неточне** — показується тільки `status === 'trial'`, не охоплює grace period після flip на `past_due`                                                                                        | `billing/page.tsx:148-152`                      | 🟢 LOW UX                |
| B16    | **Audit log change-plan без old plan / reason** — фінанс не може trace downgrade scenario                                                                                                                        | `change-plan/route.ts:23-28`                    | 🟢 LOW                   |
| B17    | **Features rendered without sanitize** — `Record<string, unknown>` рендериться як рядок. Якщо JSON містить HTML/script — XSS-vector                                                                              | `billing/page.tsx:115-122`                      | 🟢 LOW (XSS edge)        |
| B18    | **No pagination on invoices** — `findMany()` віддає всі. Через рік-два — гальмо                                                                                                                                  | `invoices/route.ts:21-24`                       | 🟢 LOW perf              |

---

## 2. 📈 Як маркетолог

**Сильні сторони:**

- Trial period — основа для acquisition funnel.
- Webhook структура готова до Stripe-like recurring billing.

**Чого бракує:**

1. **Немає revenue dashboard**: ARR/MRR/churn rate невидимі.
2. **Plan-comparison сторінка primitive** — без A/B варіацій, без highlight «найпопулярніший».
3. **Downgrade preview** — клієнт не бачить, що він втратить.
4. **No annual-vs-monthly toggle** — annual discount (типово 15-20%) приносить cash і retention.
5. **No usage metrics**: «використано 87 з 100 товарів» — апселл-тригер.
6. **No invoice email send** — invoice створюється, але не відсилається автоматично.
7. **No coupon/promo code support** на plan change.

---

## 3. 🧪 Як QA — edge cases

| #    | Сценарій                                                  | Реально                                                             | Має бути                                |
| ---- | --------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------- |
| QB1  | Multi-tenant: tenant A створив 50 товарів, tenant B - 200 | `product.count()` глобально = 250; ліміт спрацьовує помилково для B | scoped count by tenantId                |
| QB2  | Tenant A знає invoice ID tenant B → GET pdfUrl            | Без tenant-check → PDF віддається                                   | tenant-ownership check у pdf-endpoint   |
| QB3  | Webhook arrives двічі за 1с (provider retry)              | Обидва обробляються; updateMany атомарний                           | dedup за `X-Idempotency-Key`            |
| QB4  | Adminтисне «Upgrade» двічі швидко                         | 2 транзакції змінюють plan, 2 invoices                              | client ref-guard + server idempotency   |
| QB5  | Прайс 10.005 UAH                                          | Drift на округленні                                                 | Decimal arithmetic                      |
| QB6  | Upgrade plan day 27 з 30                                  | Customer платить full month                                         | proration credit                        |
| QB7  | Downgrade на план з maxProducts=10, поточно 30            | Invariant порушено, нові не можна, старі лишаються                  | confirm dialog + bulk-deactivate option |
| QB8  | Invoice numbering: 1, 2, 3, видалили 2, наступний 4       | Gap = compliance fail                                               | invoice_number sequential per tenant    |
| QB9  | Webhook без APP_SECRET в env                              | 503 = «accidentally accepted-as-valid» від staging perspective      | 401 hard-fail                           |
| QB10 | Tenant B request: `?billingId=A`                          | Поточно резолвиться через tenant — likely OK                        | defense-in-depth: explicit check        |
| QB11 | Trial expires під час webhook payment                     | Two paths: trial-billing OR payment-billing                         | explicit state machine                  |
| QB12 | Cancel-at-period-end vs cancel-immediately                | Не диференційовано                                                  | окремі прапори                          |

---

## 4. 👤 Як користувач (власник)

**Перші 30 секунд:**

- Current plan + trial countdown + список invoices. Стандарт.
- «Обрати план» — на іншу сторінку.
- «Завантажити» рахунок — натискання → broken link (pdf не генерований).

**Що болить:**

1. **Plan change без preview**: «обрав Pro» — і ось вже на Pro з повним рахунком.
2. **«Завантажити» рахунок — broken**.
3. **Немає grace period повідомлень**: «вашу підписку буде скасовано через 5 днів».
4. **Немає proration**: купив на 28-й день — заплатив за весь місяць.
5. **Trial-кінець-через-N-днів** показується тільки в trial, не після.
6. **Currency не вказана** — `190` чи `190 ₴`?
7. **Features list як JSON** — нечитабельно для нетехнічного власника.

---

## 🎯 ТОП-7 пріоритетних правок

| #   | Що                                                                                                                                                                                                                                                                                                              | Severity     | Файл                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------- |
| 1   | ⚠️ **B1** — Перевірено: Product/Order ще не tenant-scoped (single-tenant deployment), `count()` коректний. Додано документуючий коментар + `deletedAt: null` фільтр (виключаємо soft-deleted з ліміту). Реальний fix — коли multi-tenant rolls out                                                              | 🟢 N/A (now) | `services/billing.ts:173-183`                            |
| 2   | ✅ **B2** — Новий endpoint `GET /api/v1/admin/billing/invoices/[id]/pdf` з `withRole2fa` + tenant-ownership check (`invoice.billing.tenantId === resolved.tenantId`). Cross-tenant 404 (не "exists, no access"). Audit-log на кожне завантаження. Фронт-кнопка тепер ходить через нього замість direct `pdfUrl` | 🔴 HIGH      | `invoices/[id]/pdf/route.ts` (новий), `billing/page.tsx` |
| 3   | ✅ **B3** — Redis `SET NX` дедуп за `signature` (24h TTL). Duplicate provider delivery → second SET fails → early return з `{ ok: true, duplicate: true }`, без подвійного state-update і audit                                                                                                                 | 🟠 HIGH      | `billing/webhook/route.ts:43-58`                         |
| 4   | ✅ **B4** — Postgres advisory lock `pg_try_advisory_lock(PLAN, tenantId)` навколо changePlan. Друга паралельна спроба → 409. Bonus: audit-log тепер містить `oldPlanId`+`oldPlanName` для повного diff                                                                                                          | 🟠 HIGH      | `change-plan/route.ts`                                   |
| 5   | ✅ **B5** — DB migration `billing_decimal_money`: `plan.priceMonthly/priceYearly` + `billingInvoice.amount` → `Decimal(10,2)` з `USING ::DECIMAL(10,2)` cast (no data loss). Prisma schema оновлено                                                                                                             | 🟠 HIGH      | `billing.prisma`, `migration.sql`                        |
| 6   | ✅ **B7** — Plans page тепер тягне current usage + поточний план. Downgrade з overflow (товари/замовлення понад new limit) → детальний confirm. Звичайний downgrade теж confirm з повідомленням про відсутність proration                                                                                       | 🟠 HIGH      | `plans/page.tsx:50-130`                                  |
| 7   | ⚠️ **B9** — Поточний 503 семантично коректний (config error, не auth fail). `logger.error` вже видає loud signal для monitoring. Skip — Explore-агент перебільшив severity                                                                                                                                      | 🟢 N/A       | `billing/webhook/route.ts:32-37`                         |

## Бонус (residual)

- B6 — proration на upgrade/downgrade
- B8 — invoice numbering sequential per tenant
- B10 — defense-in-depth tenant check
- B11 — implement invoice PDF generation
- B12 — admin UI для plan prices
- B13 — explicit trial state machine
- B14 — webhook rate-limit + IP whitelist
- B15 — grace period messaging
- B16 — audit log old plan + reason
- B17 — features sanitize
- B18 — invoices pagination
