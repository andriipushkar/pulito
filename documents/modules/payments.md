# Модуль платежів

## Огляд

Підтримка онлайн-оплати через **WayForPay**, **LiqPay** (включно з ПриватБанк "Оплата частинами" і Sandbox), **Monobank Acquiring**, а також через **Apple Pay / Google Pay** (роутинг через WFP або LiqPay). Платежі пов'язані 1:1 з замовленнями.

## Способи оплати

| Метод                 | Код             | Опис                                             |
| --------------------- | --------------- | ------------------------------------------------ |
| Накладений платіж     | `cod`           | Оплата при отриманні                             |
| Банківський переказ   | `bank_transfer` | Рахунок-фактура (для гуртівників)                |
| Онлайн-оплата         | `online`        | LiqPay / Monobank / WayForPay / Apple-Google Pay |
| Передоплата на картку | `card_prepay`   | Переказ на картку ФОП                            |

## Online-провайдери (`paymentProvider`)

| Провайдер         | Код              | Маршрутизація                                               |
| ----------------- | ---------------- | ----------------------------------------------------------- |
| LiqPay            | `liqpay`         | Основний flow (Visa/Mastercard/Privat24)                    |
| LiqPay Розстрочка | `liqpay_paypart` | LiqPay з `paytypes='paypart'` + `instalment_count`          |
| Monobank          | `monobank`       | Mono Acquiring                                              |
| WayForPay         | `wayforpay`      | Visa/Mastercard через WFP                                   |
| Apple Pay         | `apple_pay`      | Auto-routing: WFP > LiqPay (з `paymentSystems='applePay'`)  |
| Google Pay        | `google_pay`     | Auto-routing: WFP > LiqPay (з `paymentSystems='googlePay'`) |

## Manual mode

Якщо **жоден** online-провайдер не сконфігурований → checkout автоматично показує текстове поле "Опишіть, як вам зручно оплатити" замість списку радіо-кнопок (`config.payment.manualMode = true`). На сабміті `paymentMethod` встановлюється у `cod`, а текст клієнта префіксується у `comment` як `[Оплата (зазначив клієнт)]: ...`.

## Статуси оплати

| Статус     | Опис            |
| ---------- | --------------- |
| `pending`  | Очікує оплати   |
| `paid`     | Оплачено        |
| `partial`  | Часткова оплата |
| `refunded` | Повернено       |

## Модель Payment (Prisma)

```
Payment {
  orderId         -> Order (unique, 1:1)
  paymentMethod   PaymentMethod
  paymentStatus   PaymentStatus
  amount          Decimal
  paidAt          DateTime?
  confirmedBy     -> User? (менеджер)
  transactionId   String?
  invoicePdfUrl   String?
  notes           String?
  paymentProvider String? ('liqpay' | 'monobank' | 'wayforpay')
  callbackData    Json?
}
```

> **Важливо:** для `apple_pay` / `google_pay` / `liqpay_paypart` у БД зберігається **базовий** провайдер (`wayforpay`/`liqpay`), щоб refund-routing міг знайти правильний API.

## Ініціація онлайн-оплати

**Сервіс:** `initiatePayment(orderId, provider)` — `src/services/payment.ts`

### Процес

1. Перевірка, що замовлення існує і `paymentMethod === 'online'`
2. Перевірка, що не вже оплачено
3. Routing провайдера:
   - `liqpay` → `liqpay.createPayment(...)`
   - `liqpay_paypart` → `liqpay.createPaypartPayment(...)` (з `instalment_count` з admin)
   - `monobank` → `monobank.createPayment(...)`
   - `wayforpay` → `wayforpay.createPayment(...)`
   - `apple_pay` / `google_pay` → перевірка кредеційлів, маршрут на WFP (filter `paymentSystems`) або LiqPay (`paytypes`)
4. Створення/оновлення Payment-запису з фактичним базовим провайдером
5. Повернення `redirectUrl` для переадресації клієнта

### Результат

```ts
interface PaymentInitResult {
  redirectUrl: string; // URL для переадресації
  paymentId?: string; // ID транзакції/інвойсу провайдера
}
```

## Webhook handling

**Сервіс:** `handlePaymentCallback(provider, callbackResult)`

### Webhook URLs

- LiqPay: `POST /api/webhooks/liqpay`
- Monobank: `POST /api/webhooks/monobank`
- WayForPay: `POST /api/webhooks/wayforpay`

### Процес

1. Rate-limit перевірка (per-IP)
2. Верифікація підпису від провайдера (sync для WFP, async для LiqPay/Mono)
3. Idempotency через Redis (replay-protection)
4. Amount validation проти `Order.totalAmount`
5. Оновлення `Payment.paymentStatus` + `Order.paymentStatus` у транзакції
6. Запис у `OrderStatusHistory`
7. Server-side conversion tracking (Facebook CAPI, GA4 Measurement Protocol)

## Reconciliation cron (нове)

Webhook'и іноді губляться (firewall, network blip). Cron `payment-reconciliation` бере зависанні платежі (`pending` >30 хв, ≤14 днів) і запитує статус **прямо в провайдера**.

**Сервіс:** `reconcileStuckPayments()` — `src/services/jobs/payment-reconciliation.ts`
**Endpoint:** `POST /api/v1/cron/payment-reconciliation` (Bearer `APP_SECRET`)
**Schedule:** GitHub Actions кожні 15 хв (`.github/workflows/cron-payments-tracking.yml`)

Status-check methods:

- `liqpay.checkPaymentStatus(orderId)` — POST `/api/request` з `action='status'`
- `monobank.checkInvoiceStatus(invoiceId)` — GET `/api/merchant/invoice/status`
- `wayforpay.checkTransactionStatus(orderRef)` — POST з `transactionType='CHECK_STATUS'`

При `success`/`failure` — викликає той самий `handlePaymentCallback`, що webhook.

## Refunds

**Сервіс:** `refundPayment(orderId, amount?)` — провайдерська логіка, потім тx update БД.

Підтримує **partial refunds** (часткове повернення).

## Credentials resolution

`src/services/integration-credentials.ts` — DB > env priority:

1. Спочатку шукає ключ у `siteSetting` (admin-панель `/admin/payment-settings`)
2. Якщо порожньо → fallback на `.env`

Тобто адмін може перевизначати env-ключі через UI без рестарту сервера. Кеш `getSettings()` інвалідується автоматично при збереженні.

## Adminка

**`/admin/payment-settings`** — повна панель з тоглами + полями ключів:

- **LiqPay** — public/private keys, sandbox toggle, paypart toggle + months count
- **Monobank** — token
- **WayForPay** — merchant account + secret
- **Apple Pay / Google Pay** — окрема секція з тоглами (показуються коли є будь-який gateway)
- **Cod / bank transfer / card prepay** — toggle + опційно реквізити
- **Min online amount** — `payment_min_online_amount` (грн); якщо cart < threshold → онлайн-провайдери ховаються

## Змінні `.env`

Див. `documents/setup/05-payment-providers.md` і `documents/setup/17-env-reference.md`. Усі змінні **опційні** — без них фіча просто прихована.

## Файли модуля

- `src/services/payment.ts` — initiate, callback, status, refund, routing
- `src/services/integration-credentials.ts` — DB > env credential resolution
- `src/services/payment-providers/liqpay.ts` — LiqPay API + paypart + Apple/Google
- `src/services/payment-providers/monobank.ts` — Mono Acquiring + checkInvoiceStatus
- `src/services/payment-providers/wayforpay.ts` — WFP API + checkTransactionStatus
- `src/services/jobs/payment-reconciliation.ts` — stuck-payment cron job
- `src/services/checkout-config.ts` — флаги доступності методів для UI
- `src/types/payment.ts` — типи `PaymentProvider`, `PaymentInitResult`, `PaymentCallbackResult`
- `src/validators/payment.ts` — Zod-схеми валідації
- `src/app/(shop)/checkout/payment-redirect/page.tsx` — сторінка результату оплати
- `src/components/checkout/StepPayment.tsx` — вибір способу оплати
- `src/app/(admin)/admin/payment-settings/page.tsx` — admin UI
- `src/app/api/v1/admin/payment-settings/route.ts` — admin GET/PUT
