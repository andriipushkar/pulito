# Session Handoff — Pulito Trade Security/Quality Audit

> Документ для наступної сесії Claude Code, щоб вона зрозуміла стан аудиту і продовжила з того ж місця.
> Створено: 2026-05-27

---

## 1. Що це таке

Систематичний security/correctness/UX аудит всього коду pulito.trade. На кожну секцію (admin/cabinet/public route group) — окремий цикл:

1. **Explore-agent** сканує файли секції → 10-18 findings
2. **TOP-5..7 пріоритезація** → запис у `/home/pulitotrade/pulito/проблеми/<розділ>-аналіз.md`
3. **Batch-fix** усі TOP пункти end-to-end без зупинок (per memory `feedback_batch_execution.md` + `feedback_autonomous_audit_loop.md`)
4. `npm run build` → якщо exit 0 → `pm2 restart pulito`
5. Якщо схема Prisma змінилась → `npm run db:migrate:prod`
6. Оновити running totals у `/home/pulitotrade/pulito/проблеми/TODO.md`

**Single source of truth:** `/home/pulitotrade/pulito/проблеми/TODO.md` — там точне число і таблиця по секціях.

---

## 2. Стан на момент handoff

- **Total fixes: 372**
- **Секцій оглянуто: ~70**
- **Builds: усі passed**
- **PM2 status: `pulito` online**
- **DB migrations застосовані:**
  - `20260526224827_feedback_ip_useragent`
  - `20260526230959_warehouse_stock_constraints`
- **Прогрес:** ~45% від загального roadmap

### Що ✅ повністю покрито (адмінка)

Priority 1-2 (раніше до сесії): marketplaces, orders, products, payment-settings, delivery-settings, billing, integrations, audit-log, feature-flags+health, analytics, users, categories, campaigns, loyalty, coupons, personal-prices, wholesale-rules, volume-discounts, subscriptions, referrals, bundles, homepage, pages, banners, blog.

Priority 3 (content/SEO): seo-audit, seo-templates, feeds, not-found-log, search-intel, forecasting, faq, feedback, ask.

Priority 4 (operations): warehouses, warehouse-transfers, stock-counts, pack, pallet-delivery, import, moderation, brands, badges, segments.

Priority 5 (infrastructure): channels, publications, publication-templates, domains, tenants, themes, smtp-settings, webhooks, settings, setup-2fa, bot-settings, email-templates, reports, chat, google-business.

### Що ✅ покрито (client cabinet `/me/*`)

account, addresses, wishlists, notifications, wholesale-request, telegram-link, search-history, notes, returns, account/google, export, wholesale-stats (verified OK).

### Що ✅ покрито (public site)

cart (Zod cap), orders (вже зрілий — verified OK), feeds, blog public, faq public, log-404, /delivery/pallet/calculate.

---

## 3. Що ще потрібно зробити

### Лишилось у client cabinet (priority HIGH)

- `predictions` — verified OK, skip if no issues
- `recently-viewed`
- `saved-addresses`
- `notifications/count`
- `notifications/stream` — SSE; verify connection limit per user
- `loyalty/streak`, `loyalty/challenges` — likely OK
- `referral` — verified GET-only, skip
- `subscriptions/[id]` (PATCH/DELETE)

### Public site `/[locale]/(shop)/*` / `/api/v1/*` (НЕ зачеплено майже все)

Найбільш security-критичні:

- **`/api/v1/auth/login`** — login flow, password handling
- **`/api/v1/auth/register`** — sign-up rate-limit + validation
- **`/api/v1/auth/password-reset`** — token-based reset
- **`/api/v1/auth/refresh`** — JWT refresh
- **`/api/v1/cart/validate`** — pre-checkout validation
- **`/api/v1/cart/[productId]`** — single-item operations
- **`/api/v1/checkout`** — звичайно через `/api/v1/orders` POST але є окремий endpoint?
- **`/api/v1/products/[slug]/reviews`** + `/reviews/upload` — XSS, file upload
- **`/api/v1/products/instant-search`** — public search, ReDoS surface
- **`/api/v1/products/back-in-stock`** — email subscription
- **`/api/v1/subscribe`** — newsletter
- **`/api/v1/reorder/[orderId]`** — duplicate order from past
- **`/api/v1/quick-order`** — one-click checkout flow
- **`/api/v1/track/[orderNumber]`** — order tracking via number (sensitive!)
- **`/api/v1/wholesale/bulk-order`**, **`/wholesale/commercial-proposal`**
- **`/api/webhooks/*`** — payment provider webhooks (liqpay, monobank, wayforpay), signature verification
- **`/api/webhooks/marketplaces/[platform]`**
- **`/api/webhooks/telegram`**, **`/viber`** — bot webhooks
- **`/r/c/[logId]`** — redirect click tracking
- **`/uploads/[...path]`** — file serving (path-traversal risk!)
- **`/sitemap.xml`**, **`/feed.xml`** — вже частково покрито у Feeds section, перевірити
- **`/sitemap-products/[chunk]`**
- **`/feed/google-shopping`** — вже покрито
- **`/blog/feed.xml`** — вже покрито

### Cross-cutting (0% покрито)

Це не "секції" — це системний рефакторинг, кожен — multi-day:

1. **i18n** — UA/EN/RU full extraction; багато hardcoded UA strings у адмінці. Reference: marketplace Q14 у TODO.
2. **Decimal money refactor** — всі Float price-related поля перевести на `Decimal(p,s)`. Часткове вже зроблено у billing/volume-discounts/payment. Лишається order math, invoice generation.
3. **Performance audit** — Lighthouse, Core Web Vitals, image optimization, bundle size.
4. **Security pentest** — full external pentest (бажано third-party).
5. **a11y review** — WCAG AA, screen reader testing.
6. **Mobile UX** — responsive review всіх форм/таблиць/модалок.
7. **Email deliverability** — SPF/DKIM/DMARC + reputation monitoring.
8. **Backup + DR** — Daily DB dump, S3 archive, restoration drill.
9. **Monitoring + alerting** — Sentry → on-call rotation, SLI/SLO definitions.
10. **Rate-limiting consistency review** — усюди де є зовнішні API — backoff + circuit-breaker.

---

## 4. Як виконувати — workflow

### Auto-memory вже знає (не питай)

- **`feedback_autonomous_audit_loop`** — автономний режим: після завершення секції одразу бери наступну, не питай «продовжуй?».
- **`feedback_batch_execution`** — multi-item lists: робиш все end-to-end, тільки потім summary.
- **`project_deployment`** — `npm run build` ОБОВ'ЯЗКОВО після кожної code-зміни, потім `pm2 restart pulito`. Bare restart запускає stale bundle.
- **`project_pulito_trade_behind_cloudflare`** — сайт за Cloudflare; WebFetch/curl на pulito.trade дає 403. Якщо потрібен HTML — попроси юзера paste.

### Цикл для кожної секції

```
1. find / grep — знайди файли секції
2. Read 2-4 ключових файлів (route + service + validator)
3. Якщо секція велика (10+ файлів) — Agent з subagent_type=Explore
4. Write `/home/pulitotrade/pulito/проблеми/<розділ>-аналіз.md` з TOP-5..7
5. Edit/Write fixes у service + routes + validators
6. Якщо schema.prisma → створи migration, run `npm run db:migrate:prod`
7. Bash `npm run build` (run_in_background:true, timeout 300000)
8. TaskOutput → перевір exit_code 0
9. Якщо build failed — Read error, fix, retry
10. Bash `pm2 restart pulito`
11. Edit `/home/pulitotrade/pulito/проблеми/TODO.md` — додай row + bump total
12. Report user: «<розділ> ✅ N фіксів, total X. Беру next.»
13. Беру наступну секцію
```

### Типові патерни fixes

Виявлені шаблонні issues — те що шукаю першим у кожній секції:

- **Зод-валідація відсутня** → створи Zod schema у `src/validators/<розділ>.ts`
- **Rate-limit відсутній** → `checkRateLimit(\`user:\${user.id}\`, RATE_LIMITS.X)`. Buckets: `sensitive`(3 per 15min), `adminPaymentTest`(5/min), `cart`(30/min), `adminExport`(10/min), `adminAiGenerate`(60/h), `adminImport`(5/h), `adminSeoBulk`(5/h), `publicFeed`(60/min IP), `publicDelivery`(30/min IP), `publicLog404`(30/min IP), `adminScan`(120/min), `content`(60/min), `couponValidate`(20/5min), `integration1c`(100/min), `publicLog404`(30/min)
- **`logAudit` відсутній на mutations** → додати з ipAddress, before-snapshot для PUT/DELETE
- **Cron auth тільки `APP_SECRET`** → fallback `env.CRON_SECRET || env.APP_SECRET`
- **Cron без `withCronLock`** → `const lockResult = await withCronLock(name, ttlSec, fn); if (!lockResult.acquired) return skipped; return lockResult.result`
- **`z.string().url()` пропускає `javascript:`** → `.refine((v) => isSafeUrl(v), ...)` з `@/utils/safe-url`
- **`Prisma P2002` ловиться через string match `'Unique constraint'`** → catch by `.code === 'P2002'`
- **Catch-then-update race** → wrap у `prisma.$transaction(async (tx) => {...})`
- **Multi-warehouse stock writes** → `tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(${NS}, $1::int)', warehouseId)` всередині $transaction
- **Float money math** → перевести на `Decimal(10,2)` + Prisma `@db.Decimal`
- **Pagination `Number()` без guards** → clamp `Number.isFinite && > 0`, cap `Math.min(100, ...)`
- **CSV cell starts with `=@+-`** → `defangCsvCell` prefix `'` (див `src/services/import.ts`)
- **XXE у XML parser** → `processEntities: false`
- **ZIP-bomb** → check declared total `header.size` vs `MAX_DECOMPRESSED_SIZE`
- **DELETE all без confirm** → `?confirm=all` token requirement
- **Account mutations потребують fresh password / 2FA** → `withRole2fa('admin')` middleware
- **`lockResult` from withCronLock** → ВАЖЛИВО: returns `{acquired: boolean, result?: T}` НЕ просто T. Багато старих файлів робили `if (!lockResult)` що ніколи не true (об'єкт truthy). Перевір `lockResult.acquired`.

### Конвенції

- **Audit details before-snapshot:** для PUT/DELETE завжди робити `findUnique` для prior values, передавати у `audit.details.before`. Sensitive fields (паролі, токени) — не записувати, тільки факт «changed».
- **Reserved-slug list:** `admin/api/auth/account/cart/catalog/checkout/login/logout/register/search/static/uploads/_next/app/system/root/www/mail`. Використовуй у Zod refines для будь-яких slug fields.
- **Hostname regex:** `/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i` — для tenant domain, etc.
- **Hex color regex:** `^#[0-9a-fA-F]{6}$`.
- **UA phone regex:** `^\+380\d{9}$`.
- **EDRPOU regex:** `\d{8,10}` (8 digits для legal, 10 для ФОП-ІПН).

### Test files

- Якщо змінюєш signature service-функції чи додаєш Zod 422-statuses до route — оновлюй відповідний `*.test.ts` (vitest). Мої попередні фікси оновили багато з них; нові не потребують моментально, але build не валиться через failed tests.

---

## 5. Як саме читати TODO.md

`/home/pulitotrade/pulito/проблеми/TODO.md` — основна таблиця. Колонки:

- **Розділ** — назва секції
- **Зроблено** — короткий список ID-кодів (e.g. `CH1, CH2, CH3`) з описом
- **Залишилось серед.** — middle-priority items not yet fixed
- **Залишилось низ.** — low-priority items not yet fixed
- **Multi-day** — потребує schema-migration / refactor

Останній row — `| **Всього** | **372 ✅** | ... |`. При додаванні нової секції підіймай.

Окремі файли `/home/pulitotrade/pulito/проблеми/<розділ>-аналіз.md` містять початкову TOP-table (історична позначка часу аудиту). Раніше не видаляв їх.

---

## 6. Memory files (вже існують, читай через MEMORY.md)

`/home/pulitotrade/.claude/projects/-home-pulitotrade/memory/`:

- `user_profile.md` — Ukrainian-speaking owner of pulito.trade
- `project_deployment.md` — pm2/build workflow
- `project_pulito_trade_behind_cloudflare.md` — 403 через CF
- `feedback_batch_execution.md` — batch end-to-end
- `feedback_autonomous_audit_loop.md` — autonomous mode без «продовжуй?»

Якщо нова сесія — memory автоматично завантажується у контекст.

---

## 7. Що НЕ робити

- **Не комітити автоматично у git** — користувач керує commit'ами вручну
- **Не запускати destructive migrations** без явного дозволу (DROP COLUMN, force-truncate)
- **Не змінювати JWT/encryption keys** — APP_SECRET не rotatable, не зачіпати
- **Не правити `prisma migrate dev`** — це для dev only. На prod завжди `db:migrate:prod` (= `migrate deploy`)
- **Не deploy на prod через CI** — це pulito's hand-on flow: build local → pm2 restart local
- **Не питати дозволу між секціями** — autonomous loop активний, користувач саме просив не питати
- **Не намагатися виконати `claude doctor`, `gcloud auth login`, інші interactive CLI** — кажи юзеру вводити `! <command>` у промпт сам

---

## 8. Старт нової сесії — perfect first prompt

Користувач має сказати щось у дусі:

> «Продовжуй security audit pulito.trade. Memory знає workflow. Стан і roadmap — у `/home/pulitotrade/pulito/проблеми/SESSION-HANDOFF.md` і `/home/pulitotrade/pulito/проблеми/TODO.md`. Беру наступний з roadmap, продовжуй автономно по черзі»

Тоді нова сесія:

1. Читає SESSION-HANDOFF.md (цей файл)
2. Читає TODO.md (running totals + roadmap)
3. Бере перший unblocked item з «Що ще потрібно зробити» — рекомендую почати з public site `/api/v1/auth/login` (security-critical) або з cabinet residual (`recently-viewed`/`saved-addresses`/`notifications/count`)
4. Цикл «Read → Analyse → Fix → Build → Restart → Update TODO → next» без зупинок

---

## 9. Поточні TODO running totals (snapshot)

З `/home/pulitotrade/pulito/проблеми/TODO.md`:

```
| **Всього** | **372 ✅** | **6** | **117** | **20** |
```

- **372 fixes done**
- **6 medium-priority items** open (specific items at section level — see TODO)
- **117 low-priority items** open
- **20 multi-day items** open (i18n, Decimal refactor, etc.)
