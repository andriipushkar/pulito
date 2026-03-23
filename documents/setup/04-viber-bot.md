# Налаштування Viber-бота

Viber-бот дозволяє клієнтам спілкуватися з магазином через Viber.

## Крок 1 — Створити бота на Viber

1. Перейдіть на **https://partners.viber.com/**
2. Увійдіть через свій Viber-акаунт
3. Натисніть **Create Bot Account**
4. Заповніть інформацію:
   - **Account Name**: Clean Shop
   - **Account Image**: завантажте лого магазину
   - **Category**: Shopping
   - **Subcategory**: Health & Beauty
   - **Description**: Інтернет-магазин побутової хімії
   - **Website**: https://yourdomain.com
   - **Email**: your-email@gmail.com
   - **Location**: Ukraine
5. Натисніть **Create**

## Крок 2 — Отримати Auth Token

Після створення бота:

1. На сторінці бота знайдіть розділ **Token**
2. Скопіюйте **Authentication Token** — він має вигляд довгого рядка

> **Збережіть токен** — він потрібен для .env та встановлення webhook.

## Крок 3 — Встановити Webhook

Надішліть запит до Viber API для реєстрації webhook:

```bash
curl -X POST "https://chatapi.viber.com/pa/set_webhook" \
  -H "X-Viber-Auth-Token: YOUR_VIBER_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://yourdomain.com/api/webhooks/viber",
    "event_types": [
      "delivered",
      "seen",
      "failed",
      "subscribed",
      "unsubscribed",
      "conversation_started"
    ],
    "send_name": true,
    "send_photo": true
  }'
```

Очікувана відповідь:

```json
{
  "status": 0,
  "status_message": "ok",
  "event_types": ["delivered", "seen", "failed", "subscribed", "unsubscribed", "conversation_started"]
}
```

Перевірити webhook:

```bash
curl -X POST "https://chatapi.viber.com/pa/get_account_info" \
  -H "X-Viber-Auth-Token: YOUR_VIBER_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Крок 4 — Додати змінні в .env

```env
VIBER_BOT_TOKEN=YOUR_VIBER_AUTH_TOKEN
```

Перезапустіть додаток:

```bash
# Локально
npm run dev

# Production
pm2 reload clean-shop
```

## Крок 5 — Перевірити роботу

1. Відкрийте Viber на телефоні
2. Знайдіть бота за назвою (або відскануйте QR-код з панелі partners.viber.com)
3. Натисніть **Підписатись** (Subscribe)
4. Надішліть будь-яке повідомлення
5. Бот має відповісти

## Крок 6 — QR-код для клієнтів

На сторінці бота в partners.viber.com ви знайдете QR-код. Його можна:
- Розмістити на сайті
- Надрукувати на візитках чи упаковці
- Додати в email-розсилки

## Усунення проблем

### Помилка `status: 1` (Invalid URL)

- Переконайтеся, що URL починається з `https://` (HTTP не підтримується)
- Перевірте, що домен доступний ззовні

### Помилка `status: 2` (Invalid Auth Token)

- Перевірте `VIBER_BOT_TOKEN` в .env
- Переконайтеся, що токен скопійований повністю, без зайвих пробілів

### Бот не отримує повідомлення

```bash
# Перевірте інформацію про акаунт та webhook
curl -X POST "https://chatapi.viber.com/pa/get_account_info" \
  -H "X-Viber-Auth-Token: YOUR_VIBER_AUTH_TOKEN" \
  -d '{}'
```

- Перевірте, що `webhook` поле у відповіді містить правильний URL
- Перевірте логи додатку: `pm2 logs clean-shop`

### Webhook не встановлюється

- Viber вимагає валідний SSL-сертифікат (самопідписані не підтримуються)
- Домен має бути доступний публічно
