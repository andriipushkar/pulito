# Хендовер: чистка тех-боргу юніт-тестів (vitest)

> Дата: 2026-05-29. Документ для **нової сесії**, щоб продовжити роботу.
> Мета: довести `npx vitest run` до зеленого (або максимально близько), **не маскуючи реальні баги**.

---

## 0. Поточний стан

- Старт: **222** «червоних» тест-файлів (з 695). Зараз: **~152** (фіксимо інкрементально).
- Прод-код **робочий** (білди EXIT 0, фічі задеплоєні). Це **борг тестів**, не регресії: тести відстали від рефакторів попередніх сесій.
- Усе запушено в `origin/main`. Гілка: `main`.

### Що вже зроблено (коміти)

| Коміт                         | Що                                                                                                                          | Файлів |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------ |
| `671ad94`                     | Глобальні моки `next/navigation` + `next-intl` (+ `@/i18n/navigation`) у `src/test/setup.ts`; фікс flaky invoice            | ~27    |
| `e2e669b`                     | Стандартизація моку `@/middleware/auth` (codemod ×53): `withRole`/`withRole2fa`/`withAuth`/`withOptionalAuth` + інжект user | 29     |
| `4f09e5f`                     | Мок `@/services/rate-limit` у роут-тестах (429-флакі, ×21)                                                                  | 9      |
| `4a3f40b`, `8217687`, (badge) | services: tenant/wishlist/brand/review/badge — додані prisma-методи + оновлені асерти                                       | 5      |

**Разом полагоджено ~70 файлів, 0 регресій.**

---

## 1. Робочий процес (ВАЖЛИВО)

1. **Працювати областю**: бери папку, лагодь усі її файли, запускай область, коміть `test(<area>): ...`.
2. **Швидкий прогон області**: `npx vitest run src/<path>` (НЕ весь набір — він ~6 хв).
3. **Перевірка регресій** (раз на кілька батчів): повний прогін у JSON і diff множин «червоних» before/after — жодного green→red:
   ```
   npx vitest run --reporter=json --outputFile=/tmp/after.json
   # node-скрипт порівняння множин t.status==="failed"
   ```
4. **Не маскувати баги**: якщо тест падає бо сервіс змінив поведінку — питання: тест застарів (оновити тест) чи це РЕГРЕСІЯ КОДУ (тест правий)? Якщо схоже на реальний баг — **флагнути**, не правити «щоб позеленіло».
5. `vi.clearAllMocks()` чистить виклики, але **НЕ** імплементації (`mockResolvedValue`). Тому `mockResolvedValueOnce`/per-test override іноді «протікає» між тестами — стався уважно.

---

## 2. Перевірені патерни (повторно використовувати)

### Глобальні моки — вже в `src/test/setup.ts` (не чіпати, працює)

`next/image`, `next/link`, `next/navigation`, `@/i18n/navigation`, `next-intl`.
⚠️ Глобальний `next-intl` `useTranslations` повертає **сам ключ** (passthrough). Тому компоненти, що **асертять реальний UA-текст** (див. `components/admin/analytics`), з ним НЕ позеленіють — їм потрібен **локальний** мок `next-intl` з реальними перекладами (див. §3).

### Стандартний мок auth (для роут-тестів, де ще не застосовано)

```ts
vi.mock('@/middleware/auth', () => {
  const withUser = (_req: unknown, ctx?: Record<string, unknown>) => ({
    user: { id: 1, email: 'admin@test.com', role: 'admin' },
    ...(ctx || {}),
  });
  const roleWrap =
    (..._r: unknown[]) =>
    (h: Function) =>
    (req: unknown, ctx?: Record<string, unknown>) =>
      h(req, withUser(req, ctx));
  const authWrap = (h: Function) => (req: unknown, ctx?: Record<string, unknown>) =>
    h(req, withUser(req, ctx));
  return {
    withRole: roleWrap,
    withRole2fa: roleWrap,
    withAuth: authWrap,
    withOptionalAuth: authWrap,
  };
});
```

### Стандартний мок rate-limit (для роутів, що 429-лять)

```ts
vi.mock('@/services/rate-limit', () => ({
  checkRateLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, remaining: 100, resetAt: Date.now() + 60000 }),
  checkLoginRateLimit: vi.fn().mockResolvedValue(undefined),
  recordFailedLogin: vi.fn().mockResolvedValue(undefined),
  clearLoginAttempts: vi.fn().mockResolvedValue(undefined),
  withRateLimit: () => (h: Function) => h,
  RATE_LIMITS: new Proxy({}, { get: () => ({ limit: 100, windowSeconds: 60 }) }),
}));
```

---

## 3. Залишок: причини падінь і як лагодити

Кластери (за сигнатурою помилки на ~152 файли):

- **~80 «expected N to be N»** — невідповідність статус-кодів. Запусти файл і **читай stderr**: роут логує реальну помилку (`logger.error`). Зазвичай:
  - **500** — роут кидає, бо НЕ змокано якийсь сервіс/prisma-метод, який він викликає. Додай мок (`vi.mock` сервісу) або відсутній prisma-метод.
  - **422 vs 400** — валідація стала суворішою; онови очікуваний код у тесті.
  - **401/403** — auth-логіка; перевір, що стандартний auth-мок інжектить потрібну роль.
- **TypeError: `prisma.X.method is not a function` / `reading '...' of undefined`** — у мок-обʼєкті бракує prisma-моделі/методу. Додай (з sensible default: `count→0`, `groupBy→[]`, `createMany→{count:0}`, `$queryRaw→[{ok:true}]`, `$transaction→` див. нижче).
- **`$transaction` не функція** — якщо сервіс юзає callback-форму, мок має **виконувати колбек**:
  ```ts
  $transaction: vi.fn().mockImplementation((arg) => typeof arg === 'function' ? arg(mockPrisma) : undefined),
  ```
  (масив-форму просто `vi.fn().mockResolvedValue([...])`).
- **Stale-асерти від рефакторів** — напр. сервіс перейшов `create×N → createMany×1` (як `badge`), або повертає нове поле (як `brand.affectedProducts`), або агрегує через `groupBy` замість `findMany` (як `review.getProductRatingStats`). Читай сервіс, онови очікування.
- **`components/admin/analytics` (11)** — асертять реальний UA-текст. Дай їм **локальний** мок `next-intl`, що читає `src/messages/uk.json` і повертає реальні рядки за ключем (namespace-aware). Або послаб асерти до структурних. ⚠️ Перевір ICU-плейсхолдери `{...}`.
- **`app/api/webhooks` (6)** — складні: перевірка підписів (liqpay/monobank/wayforpay), обробка платежів, telegram/viber. Потрібно мокати верифікатор підпису / сервіси оплати; **обережно — тут легко замаскувати баг верифікації**. Залишено наостанок.

---

## 4. Worklist (актуальний, ~152 файли за областями)

> Порядок рекомендований: спершу tractable (services-залишок, прості components), потім app/api/v1 по підпапках, наприкінці webhooks/analytics.

<!-- WORKLIST -->

### app/api/v1 (81)

- src/app/api/v1/admin/analytics/segments/route.test.ts
- src/app/api/v1/admin/banners/[id]/route.test.ts
- src/app/api/v1/admin/banners/[id]/upload/route.test.ts
- src/app/api/v1/admin/banners/route.test.ts
- src/app/api/v1/admin/billing/change-plan/route.test.ts
- src/app/api/v1/admin/billing/invoices/route.test.ts
- src/app/api/v1/admin/billing/route.test.ts
- src/app/api/v1/admin/blog/[id]/route.test.ts
- src/app/api/v1/admin/bot-replies/[id]/route.test.ts
- src/app/api/v1/admin/bundles/[id]/route.test.ts
- src/app/api/v1/admin/campaigns/[id]/route.test.ts
- src/app/api/v1/admin/categories/[id]/merge/route.test.ts
- src/app/api/v1/admin/channel-settings/test/route.test.ts
- src/app/api/v1/admin/coupons/[id]/route.test.ts
- src/app/api/v1/admin/domains/[domain]/route.test.ts
- src/app/api/v1/admin/domains/route.test.ts
- src/app/api/v1/admin/domains/verify/route.test.ts
- src/app/api/v1/admin/email-templates/[id]/route.test.ts
- src/app/api/v1/admin/email-templates/[id]/test/route.test.ts
- src/app/api/v1/admin/faq/[id]/route.test.ts
- src/app/api/v1/admin/feature-flags/[key]/route.test.ts
- src/app/api/v1/admin/import/images/route.test.ts
- src/app/api/v1/admin/import/products/route.test.ts
- src/app/api/v1/admin/loyalty/adjust/route.test.ts
- src/app/api/v1/admin/maintenance/route.test.ts
- src/app/api/v1/admin/marketplaces/[id]/route.test.ts
- src/app/api/v1/admin/moderation/rules/route.test.ts
- src/app/api/v1/admin/notifications/stream/route.test.ts
- src/app/api/v1/admin/orders/[id]/comment/route.test.ts
- src/app/api/v1/admin/orders/[id]/ttn/route.test.ts
- src/app/api/v1/admin/orders/bulk-ttn/route.test.ts
- src/app/api/v1/admin/pages/[id]/route.test.ts
- src/app/api/v1/admin/personal-prices/[id]/route.test.ts
- src/app/api/v1/admin/products/bulk/route.test.ts
- src/app/api/v1/admin/publications/[id]/publish/route.test.ts
- src/app/api/v1/admin/publications/[id]/retry/route.test.ts
- src/app/api/v1/admin/publications/[id]/route.test.ts
- src/app/api/v1/admin/publications/route.test.ts
- src/app/api/v1/admin/referrals/[id]/bonus/route.test.ts
- src/app/api/v1/admin/revalidate/route.test.ts
- src/app/api/v1/admin/settings/route.test.ts
- src/app/api/v1/admin/smtp-settings/route.test.ts
- src/app/api/v1/admin/smtp-settings/test/route.test.ts
- src/app/api/v1/admin/tenants/[id]/route.test.ts
- src/app/api/v1/admin/tenants/route.test.ts
- src/app/api/v1/admin/themes/[id]/route.test.ts
- src/app/api/v1/admin/themes/route.test.ts
- src/app/api/v1/auth/2fa/disable/route.test.ts
- src/app/api/v1/auth/2fa/setup/route.test.ts
- src/app/api/v1/auth/2fa/verify/route.test.ts
- src/app/api/v1/auth/reset-password/route.test.ts
- src/app/api/v1/auth/verify-email/route.test.ts
- src/app/api/v1/banners/route.test.ts
- src/app/api/v1/cart/[productId]/route.test.ts
- src/app/api/v1/cart/route.test.ts
- src/app/api/v1/chat/route.test.ts
- src/app/api/v1/cookie-consent/route.test.ts
- src/app/api/v1/cron/process-subscriptions/route.test.ts
- src/app/api/v1/cron/publications/route.test.ts
- src/app/api/v1/cron/sync-marketplace-orders/route.test.ts
- src/app/api/v1/delivery/tracking/route.test.ts
- src/app/api/v1/faq/route.test.ts
- src/app/api/v1/health/route.test.ts
- src/app/api/v1/me/account/route.test.ts
- src/app/api/v1/me/login-history/route.test.ts
- src/app/api/v1/me/loyalty/transactions/route.test.ts
- src/app/api/v1/me/notes/route.test.ts
- src/app/api/v1/me/recently-viewed/route.test.ts
- src/app/api/v1/me/search-history/route.test.ts
- src/app/api/v1/me/subscriptions/route.test.ts
- src/app/api/v1/me/wholesale-request/route.test.ts
- src/app/api/v1/me/wishlists/route.test.ts
- src/app/api/v1/orders/[id]/pay/route.test.ts
- src/app/api/v1/pages/route.test.ts
- src/app/api/v1/pricelist/route.test.ts
- src/app/api/v1/publications/route.test.ts
- src/app/api/v1/push/subscribe/route.test.ts
- src/app/api/v1/push/unsubscribe/route.test.ts
- src/app/api/v1/subscribe/route.test.ts
- src/app/api/v1/wholesale/bulk-order/route.test.ts
- src/app/api/v1/wholesale/commercial-proposal/route.test.ts

### services (23)

- src/services/billing.test.ts
- src/services/blog.test.ts
- src/services/cart.test.ts
- src/services/coupon.test.ts
- src/services/delivery-address.test.ts
- src/services/domain.test.ts
- src/services/faq.test.ts
- src/services/feedback.test.ts
- src/services/image.padding.integration.test.ts
- src/services/image.test.ts
- src/services/integration-1c.test.ts
- src/services/order.test.ts
- src/services/payment-tracking.test.ts
- src/services/payment.test.ts
- src/services/personal-price.test.ts
- src/services/product.test.ts
- src/services/publication.test.ts
- src/services/report-generator.test.ts
- src/services/return-request.test.ts
- src/services/static-page.test.ts
- src/services/telegram.test.ts
- src/services/theme.test.ts
- src/services/user.test.ts

### components/admin/analytics (11)

- src/components/admin/analytics/ABCAnalysis.test.tsx
- src/components/admin/analytics/AlertsConfig.test.tsx
- src/components/admin/analytics/ChannelAnalytics.test.tsx
- src/components/admin/analytics/ChurnPrediction.test.tsx
- src/components/admin/analytics/CohortAnalysis.test.tsx
- src/components/admin/analytics/ConversionFunnel.test.tsx
- src/components/admin/analytics/GeographyAnalytics.test.tsx
- src/components/admin/analytics/PerformanceWidget.test.tsx
- src/components/admin/analytics/PriceAnalytics.test.tsx
- src/components/admin/analytics/RFMAnalysis.test.tsx
- src/components/admin/analytics/StockAnalytics.test.tsx

### components/admin (8)

- src/components/admin/CommandPalette.test.tsx
- src/components/admin/CreateTTNForm.test.tsx
- src/components/admin/ErrorBoundary.test.tsx
- src/components/admin/HelpPanel.test.tsx
- src/components/admin/OrderItemsEditor.test.tsx
- src/components/admin/PageSizeSelector.test.tsx
- src/components/admin/UsageMeter.test.tsx
- src/components/admin/WysiwygEditor.test.tsx

### app/api/webhooks (6)

- src/app/api/webhooks/liqpay/route.test.ts
- src/app/api/webhooks/marketplaces/[platform]/route.test.ts
- src/app/api/webhooks/monobank/route.test.ts
- src/app/api/webhooks/telegram/route.test.ts
- src/app/api/webhooks/viber/route.test.ts
- src/app/api/webhooks/wayforpay/route.test.ts

### components/product (4)

- src/components/product/ComparisonTable.test.tsx
- src/components/product/ProductCarousel.test.tsx
- src/components/product/ProductInfo.test.tsx
- src/components/product/RecentlyViewedSection.test.tsx

### components/checkout (3)

- src/components/checkout/StepConfirmation.test.tsx
- src/components/checkout/StepDelivery.test.tsx
- src/components/checkout/StepPayment.test.tsx

### components/home (3)

- src/components/home/BannerSlider.test.tsx
- src/components/home/BrandLogos.test.tsx
- src/components/home/CategoryGrid.test.tsx

### services/jobs (2)

- src/services/jobs/auto-cancel-orders.test.ts
- src/services/jobs/process-subscriptions.test.ts

### app/sitemap-products/[chunk] (1)

- src/app/sitemap-products/[chunk]/route.test.ts

### app (1)

- src/app/sitemap.test.ts

### app/uploads/[...path] (1)

- src/app/uploads/[...path]/route.test.ts

### components/cart (1)

- src/components/cart/CartItemRow.test.tsx

### components/common (1)

- src/components/common/ContactForm.test.tsx

### components/faq (1)

- src/components/faq/FaqContent.test.tsx

### hooks (1)

- src/hooks/useAdminNotifications.test.ts

### i18n (1)

- src/i18n/routing.test.ts

### lib (1)

- src/lib/api-client.test.ts

### providers (1)

- src/providers/AuthProvider.test.tsx

### services/payment-providers (1)

- src/services/payment-providers/monobank.test.ts
