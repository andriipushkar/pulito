# Модуль сповіщень

## Огляд

Мультиканальна система сповіщень: внутрішні (in-app), email, Telegram, Viber, Web Push. Розсилка через чергу з урахуванням налаштувань користувача.

## Типи сповіщень

| Тип | Код | Опис |
|-----|-----|------|
| Статус замовлення | `order_status` | Зміна статусу замовлення |
| Зміна ціни | `price_change` | Ціна на товар змінилась |
| Повернення в наявність | `back_in_stock` | Товар знову в наявності |
| Акція | `promo` | Промо-пропозиція |
| Системне | `system` | Системне повідомлення |

## Канали доставки

| Канал | Опис |
|-------|------|
| In-app | Внутрішні сповіщення (UserNotification) |
| Email | Через SMTP (nodemailer) |
| Telegram | Через Telegram Bot API |
| Viber | Через Viber API |
| Push | Web Push через VAPID |

## Внутрішні сповіщення (In-app)

### Сервіс (`src/services/notification.ts`)

**createNotification(data):**
Створює запис в `UserNotification`. Поля: userId, type, title, message, link.

**getUserNotifications(userId, { page, limit }):**
Повертає пагінований список + total + unreadCount.

**getUnreadCount(userId):**
Кількість непрочитаних.

**markAsRead(id, userId):**
Позначає як прочитане (встановлює readAt).

**markAllAsRead(userId):**
Масове прочитання.

**deleteNotification(id, userId):**
Видалення конкретного.

**deleteReadNotifications(userId):**
Видалення всіх прочитаних.

**cleanupExpiredNotifications(maxAgeDays = 90):**
Видалення прочитаних старше 90 днів (для cron).

### Хелпер для замовлень

**notifyOrderStatusChange(userId, orderNumber, newStatus, orderId):**
Автоматичне створення сповіщення зі зрозумілим текстом:
```
Замовлення #20250122-1234
Статус вашого замовлення змінено на "Відправлене"
```

Мітки статусів: В обробці, Підтверджене, Оплачене, Відправлене, Виконане, Скасоване, Повернення.

### Ендпоінти

- `GET /api/v1/me/notifications` -- список сповіщень
- `GET /api/v1/me/notifications/unread-count` -- кількість непрочитаних
- `PUT /api/v1/me/notifications/:id/read` -- позначити як прочитане
- `PUT /api/v1/me/notifications/read-all` -- прочитати всі
- `DELETE /api/v1/me/notifications/:id` -- видалити

## Черга сповіщень (Notification Queue)

### Модель NotificationQueue (Prisma)

```
NotificationQueue {
  channel       NotificationChannel (email/telegram/viber/instagram/push)
  recipient     String
  subject       String?
  bodyTemplate  String
  bodyParams    Json?
  status        QueueStatus (pending/processing/sent/failed)
  attempts      Int (default 0)
  maxAttempts   Int (default 3)
  errorMessage  String?
  scheduledAt   DateTime?
  sentAt        DateTime?
}
```

### Обробка черги (`src/services/notification-queue.ts`)

**processNotificationQueue():**

1. Знаходить непрочитані сповіщення за останні 24 години
2. Для кожного перевіряє налаштування користувача (`notificationPrefs`)
3. Розсилає через відповідні канали:

**Налаштування користувача (notificationPrefs JSON):**

| Ключ | За замовчуванням | Опис |
|------|-----------------|------|
| `email_orders` | `true` | Email для статусів замовлень |
| `email_promo` | `true` | Email для акцій |
| `telegram_orders` | `true` | Telegram для замовлень |
| `telegram_promo` | `true` | Telegram для акцій |
| `viber_orders` | `true` | Viber для замовлень |
| `viber_promo` | `true` | Viber для акцій |

**Логіка розсилки:**
- **Email:** `sendEmail()` з HTML-контентом
- **Telegram:** `sendClientNotification()` (крім order_status, бо вони надсилаються inline)
- **Viber:** `sendViberNotification()` (крім order_status)
- **Push:** `sendPushNotification()` -- завжди

Повертає: `{ sent, skipped }`

## Email-сповіщення

### Транспорт
Nodemailer з SMTP. Retry до 3 разів з exponential backoff.

### Типи листів
- Верифікація email (24h TTL)
- Скидання пароля (1h TTL)
- Сповіщення про замовлення (через queue)
- Промо-розсилки (через queue)

### Шаблони email
Зберігаються в `EmailTemplate` з версіонуванням. Маркетингові шаблони позначені `isMarketing`.

## Telegram-сповіщення

### Менеджерам
- Нове замовлення (автоматично при створенні)
- Зворотний зв'язок (автоматично при формі)

### Клієнтам
- Зміна статусу замовлення (inline при зміні)
- Загальні сповіщення (через queue)

Потрібна прив'язка: `telegramChatId` в User.

## Viber-сповіщення

Надсилаються через `sendViberNotification()` для прив'язаних акаунтів (`viberUserId` в User).

## Web Push

### Підписка
- `subscribePush(userId, subscription)` -- зберігає endpoint, p256dh, auth
- `unsubscribePush(endpoint)` -- видаляє підписку

### Надсилання
- `sendPushNotification(userId, payload)` -- конкретному користувачу
- `sendPushToAll(payload)` -- масова розсилка (батчами по 50)

### Автоочищення
Невалідні підписки (HTTP 410) автоматично видаляються.

## Файли модуля

- `src/services/notification.ts` -- in-app сповіщення
- `src/services/notification-queue.ts` -- обробка черги
- `src/services/email.ts` -- SMTP відправка
- `src/services/email-template.ts` -- шаблони email
- `src/services/telegram.ts` -- Telegram Bot
- `src/services/viber.ts` -- Viber Bot
- `src/services/push.ts` -- Web Push
- `src/app/api/v1/me/notifications/` -- ендпоінти
- `src/app/(shop)/account/notifications/page.tsx` -- UI сторінка
