# Модуль платежів

## Огляд

Підтримка онлайн-оплати через два провайдери: LiqPay та Monobank. Платежі пов'язані 1:1 з замовленнями.

## Способи оплати

| Метод | Код | Опис |
|-------|-----|------|
| Накладений платіж | `cod` | Оплата при отриманні |
| Банківський переказ | `bank_transfer` | Рахунок-фактура (для оптовиків) |
| Онлайн-оплата | `online` | LiqPay або Monobank |
| Передоплата на картку | `card_prepay` | Переказ на картку |

## Статуси оплати

| Статус | Опис |
|--------|------|
| `pending` | Очікує оплати |
| `paid` | Оплачено |
| `partial` | Часткова оплата |
| `refunded` | Повернено |

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
  paymentProvider String? ('liqpay' | 'monobank')
  callbackData    Json?
}
```

## Ініціація онлайн-оплати

**Сервіс:** `initiatePayment(orderId, provider)`

### Процес

1. Перевірка, що замовлення існує
2. Перевірка, що `paymentMethod === 'online'`
3. Перевірка, що не вже оплачено
4. Виклик API провайдера:
   - **LiqPay:** `liqpay.createPayment(orderId, amount, description, resultUrl, serverUrl)`
   - **Monobank:** `monobank.createPayment(orderId, amount, description, resultUrl, webhookUrl)`
5. Створення/оновлення запису Payment
6. Повернення URL для переадресації клієнта

### Результат
```ts
interface PaymentInitResult {
  paymentUrl: string;  // URL для переадресації
  paymentId?: string;  // ID транзакції провайдера
}
```

## Обробка callback/webhook

**Сервіс:** `handlePaymentCallback(provider, callbackResult)`

### Webhook URLs
- LiqPay: `POST /api/webhooks/liqpay`
- Monobank: `POST /api/webhooks/monobank`

### Процес

1. Верифікація підпису від провайдера
2. Парсинг результату:
```ts
interface PaymentCallbackResult {
  orderId: number;
  status: 'success' | 'failure' | 'processing';
  transactionId?: string;
  rawData: unknown;
}
```
3. Оновлення Payment: статус, transactionId, callbackData, paidAt
4. При успішній оплаті:
   - Оновлення `paymentStatus` замовлення на `paid`
   - Запис в OrderStatusHistory

## Провайдери

### LiqPay

**Змінні:**
- `LIQPAY_PUBLIC_KEY`
- `LIQPAY_PRIVATE_KEY`

**Модуль:** `src/services/payment-providers/liqpay.ts`

### Monobank

**Змінні:**
- `MONOBANK_TOKEN`

**Модуль:** `src/services/payment-providers/monobank.ts`

## Перевірка статусу

**Сервіс:** `getPaymentStatus(orderId)`

Повертає: `paymentStatus`, `paymentProvider`, `transactionId`, `amount`, `paidAt`.

## Переадресація після оплати

**Сторінка:** `/checkout/payment-redirect?orderId=<id>`

Перевіряє статус оплати та показує результат клієнту.

## Рахунки-фактури

Для `bank_transfer` замовлень генерується PDF-рахунок (`invoicePdfUrl`), який менеджер може підтвердити вручну.

## Файли модуля

- `src/services/payment.ts` -- основна логіка (initiate, callback, status)
- `src/services/payment-providers/liqpay.ts` -- LiqPay API
- `src/services/payment-providers/monobank.ts` -- Monobank API
- `src/types/payment.ts` -- типи PaymentProvider, PaymentInitResult, PaymentCallbackResult
- `src/validators/payment.ts` -- Zod-схеми валідації
- `src/app/(shop)/checkout/payment-redirect/page.tsx` -- сторінка результату оплати
- `src/components/checkout/StepPayment.tsx` -- вибір способу оплати
