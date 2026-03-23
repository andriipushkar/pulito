# Змінні оточення

Валідація виконується в `src/config/env.ts` через Zod-схему при запуску додатку.

## Загальні

| Змінна | Тип | Обов'язковість | За замовчуванням | Опис |
|--------|-----|---------------|-----------------|------|
| `NODE_ENV` | enum | Ні | `development` | Режим роботи: `development`, `production`, `test` |
| `PORT` | number | Ні | `3000` | Порт HTTP-сервера |
| `APP_URL` | string (URL) | Ні | `http://localhost:3000` | Базова URL адреса додатку (використовується для формування посилань в листах, ботах тощо) |
| `APP_SECRET` | string (min 8) | Ні | `dev-app-secret-not-for-production` | Секрет для захисту cron-ендпоінтів та внутрішніх API |
| `LOG_LEVEL` | enum | Ні | `info` | Рівень логування: `debug`, `info`, `warn`, `error` |
| `MAINTENANCE_MODE` | enum | Ні | `false` | Режим обслуговування: `true` / `false` |

## База даних

| Змінна | Тип | Обов'язковість | Опис | Приклад |
|--------|-----|---------------|------|---------|
| `DATABASE_URL` | string | **Так** | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/clean_shop` |
| `REDIS_URL` | string | Ні | Redis connection string (за замовчуванням `redis://localhost:6380/0`) | `redis://localhost:6380/0` |

## Автентифікація (JWT)

| Змінна | Тип | Обов'язковість | За замовчуванням | Опис | Приклад |
|--------|-----|---------------|-----------------|------|---------|
| `JWT_SECRET` | string (min 16) | **Так** | -- | Секрет для підпису JWT-токенів | `my-super-secret-jwt-key-32chars` |
| `JWT_ACCESS_TTL` | string | Ні | `15m` | Час життя access-токена (формат: `<число><s/m/h/d>`) | `15m`, `1h` |
| `JWT_REFRESH_TTL` | string | Ні | `30d` | Час життя refresh-токена | `30d`, `7d` |

## SMTP (Email)

| Змінна | Тип | Обов'язковість | За замовчуванням | Опис | Приклад |
|--------|-----|---------------|-----------------|------|---------|
| `SMTP_HOST` | string | Ні | `smtp.gmail.com` | SMTP-хост | `smtp.gmail.com` |
| `SMTP_PORT` | number | Ні | `587` | SMTP-порт (587=TLS, 465=SSL) | `587` |
| `SMTP_USER` | string | Ні | `""` | SMTP-логін | `shop@gmail.com` |
| `SMTP_PASS` | string | Ні | `""` | SMTP-пароль (App Password для Gmail) | `xxxx xxxx xxxx xxxx` |
| `SMTP_FROM` | string | Ні | `noreply@localhost` | Адреса відправника | `"Clean Shop" <shop@clean-shop.ua>` |

## Файли та зображення

| Змінна | Тип | Обов'язковість | За замовчуванням | Опис | Приклад |
|--------|-----|---------------|-----------------|------|---------|
| `UPLOAD_DIR` | string | Ні | `./uploads` | Директорія для завантажених файлів | `./uploads` |
| `MAX_FILE_SIZE` | number | Ні | `10485760` | Максимальний розмір файлу в байтах (10 MB) | `10485760` |

## Google OAuth

| Змінна | Тип | Обов'язковість | За замовчуванням | Опис | Приклад |
|--------|-----|---------------|-----------------|------|---------|
| `GOOGLE_CLIENT_ID` | string | Ні | `""` | Google OAuth Client ID | `123456789.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | string | Ні | `""` | Google OAuth Client Secret | `GOCSPX-xxxxxxxxxxxxxx` |

## Instagram (Graph API)

| Змінна | Тип | Обов'язковість | За замовчуванням | Опис | Приклад |
|--------|-----|---------------|-----------------|------|---------|
| `INSTAGRAM_ACCESS_TOKEN` | string | Ні | `""` | Long-lived access token | `IGQ...` |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | string | Ні | `""` | ID бізнес-акаунту | `17841405793187218` |
| `INSTAGRAM_APP_ID` | string | Ні | `""` | Facebook App ID | `123456789` |
| `INSTAGRAM_APP_SECRET` | string | Ні | `""` | Facebook App Secret | `abc123def456` |

## Telegram Bot

| Змінна | Тип | Обов'язковість | За замовчуванням | Опис | Приклад |
|--------|-----|---------------|-----------------|------|---------|
| `TELEGRAM_BOT_TOKEN` | string | Ні | `""` | Токен бота від @BotFather | `7123456789:AAH...` |
| `TELEGRAM_MANAGER_CHAT_ID` | string | Ні | `""` | Chat ID для сповіщень менеджера | `-1001234567890` |

## Нова Пошта

| Змінна | Тип | Обов'язковість | За замовчуванням | Опис | Приклад |
|--------|-----|---------------|-----------------|------|---------|
| `NOVA_POSHTA_API_KEY` | string | Ні | `""` | API-ключ Нової Пошти | `a1b2c3d4e5f6g7h8` |

## Укрпошта

| Змінна | Тип | Обов'язковість | За замовчуванням | Опис | Приклад |
|--------|-----|---------------|-----------------|------|---------|
| `UKRPOSHTA_BEARER_TOKEN` | string | Ні | `""` | Bearer-токен API Укрпошти | `eyJhbGc...` |

## Платіжні провайдери

| Змінна | Тип | Обов'язковість | За замовчуванням | Опис | Приклад |
|--------|-----|---------------|-----------------|------|---------|
| `LIQPAY_PUBLIC_KEY` | string | Ні | `""` | LiqPay публічний ключ | `sandbox_i12345` |
| `LIQPAY_PRIVATE_KEY` | string | Ні | `""` | LiqPay приватний ключ | `sandbox_xxxxxx` |
| `MONOBANK_TOKEN` | string | Ні | `""` | Monobank API токен | `uXyz...` |

## Web Push (PWA)

Ці змінні не визначені в env.ts, але використовуються через `process.env`:

| Змінна | Тип | Обов'язковість | Опис | Приклад |
|--------|-----|---------------|------|---------|
| `VAPID_PUBLIC_KEY` | string | Ні | VAPID публічний ключ | `BHxLR...` |
| `VAPID_PRIVATE_KEY` | string | Ні | VAPID приватний ключ | `xyza1...` |
| `VAPID_EMAIL` | string | Ні | Контактний email | `mailto:noreply@clean-shop.ua` |

## Viber Bot

Ця змінна використовується через `process.env` (не в env.ts):

| Змінна | Тип | Обов'язковість | Опис | Приклад |
|--------|-----|---------------|------|---------|
| `VIBER_AUTH_TOKEN` | string | Ні | Auth Token Viber | `4dc...` |

## Telegram Channel (публікації)

Ця змінна використовується через `process.env` в publication service:

| Змінна | Тип | Обов'язковість | Опис | Приклад |
|--------|-----|---------------|------|---------|
| `TELEGRAM_CHANNEL_ID` | string | Ні | ID каналу для публікацій | `@cleanshop_channel` |

## Приклад .env файлу

```env
# === Обов'язкові ===
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clean_shop
JWT_SECRET=your-super-secret-jwt-key-minimum-16-chars

# === Загальні ===
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
APP_SECRET=dev-app-secret-change-in-prod
LOG_LEVEL=info
MAINTENANCE_MODE=false

# === Redis ===
REDIS_URL=redis://localhost:6380/0

# === JWT ===
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

# === SMTP ===
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=shop@clean-shop.ua
SMTP_PASS=xxxx-xxxx-xxxx-xxxx
SMTP_FROM="Clean Shop <shop@clean-shop.ua>"

# === Файли ===
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# === Google OAuth ===
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# === Instagram ===
INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_BUSINESS_ACCOUNT_ID=
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=

# === Telegram ===
TELEGRAM_BOT_TOKEN=
TELEGRAM_MANAGER_CHAT_ID=
TELEGRAM_CHANNEL_ID=

# === Viber ===
VIBER_AUTH_TOKEN=

# === Нова Пошта ===
NOVA_POSHTA_API_KEY=

# === Укрпошта ===
UKRPOSHTA_BEARER_TOKEN=

# === Платежі ===
LIQPAY_PUBLIC_KEY=
LIQPAY_PRIVATE_KEY=
MONOBANK_TOKEN=

# === Web Push ===
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=mailto:noreply@clean-shop.ua
```
