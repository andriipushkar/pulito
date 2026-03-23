# Довідник змінних середовища (.env)

Повний список всіх змінних з поясненнями. Копіюйте `.env.example` → `.env` та заповнюйте.

---

## Обов'язкові для запуску

| Змінна | Приклад | Опис |
|--------|---------|------|
| `NODE_ENV` | `production` | `development` / `production` / `test` |
| `PORT` | `3000` | Порт додатку |
| `APP_URL` | `https://poroshok.com` | Публічний URL сайту (для посилань, OAuth, webhooks) |
| `DATABASE_URL` | `postgresql://user:pass@localhost:6432/db` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6380/0` | Redis connection string |
| `JWT_SECRET` | `openssl rand -hex 32` | Секрет для JWT токенів (мін. 32 символи) |
| `APP_SECRET` | `openssl rand -hex 32` | Секрет для CSRF, підписів (мін. 32 символи) |

---

## База даних

| Змінна | За замовчуванням | Опис |
|--------|-----------------|------|
| `DATABASE_POOL_MIN` | `2` | Мінімум з'єднань у пулі (для дешевого VPS: `1`) |
| `DATABASE_POOL_MAX` | `10` | Максимум з'єднань у пулі (для дешевого VPS: `5`) |

> Для production з PgBouncer рекомендовано `DATABASE_POOL_MAX=5` — PgBouncer мультиплексує їх до 200 клієнтських.

---

## JWT

| Змінна | За замовчуванням | Опис |
|--------|-----------------|------|
| `JWT_ACCESS_TTL` | `15m` | Час життя access token (15 хвилин) |
| `JWT_REFRESH_TTL` | `30d` | Час життя refresh token (30 днів) |
| `JWT_ALGORITHM` | `HS256` | Алгоритм підпису: `HS256` (симетричний) або `RS256` (асиметричний) |
| `JWT_PRIVATE_KEY_PATH` | — | Шлях до private.pem (тільки для RS256) |
| `JWT_PUBLIC_KEY_PATH` | — | Шлях до public.pem (тільки для RS256) |

> RS256 потрібен тільки якщо токени верифікуються зовнішніми сервісами. Для звичайного магазину `HS256` достатньо.

---

## Файли та зображення

| Змінна | За замовчуванням | Опис |
|--------|-----------------|------|
| `UPLOAD_DIR` | `./uploads` | Директорія для завантажених файлів |
| `MAX_FILE_SIZE` | `10485760` | Макс. розмір файлу в байтах (10 MB) |
| `WATERMARK_TEXT` | `poroshok.com` | Текст водяного знака на зображеннях товарів |
| `WATERMARK_ENABLED` | `true` | `false` щоб вимкнути водяний знак |

---

## Пошук (Typesense)

| Змінна | За замовчуванням | Опис |
|--------|-----------------|------|
| `TYPESENSE_HOST` | `localhost` | Хост Typesense сервера |
| `TYPESENSE_PORT` | `8108` | Порт Typesense |
| `TYPESENSE_API_KEY` | `ts-clean-dev-key` | API ключ (ЗМІНИТИ для production!) |
| `TYPESENSE_PROTOCOL` | `http` | `https` для production |

> Для production згенеруйте ключ: `openssl rand -hex 32`

---

## Оплата

| Змінна | Гайд | Опис |
|--------|------|------|
| `LIQPAY_PUBLIC_KEY` | [05-payment-providers.md](05-payment-providers.md) | LiqPay публічний ключ |
| `LIQPAY_PRIVATE_KEY` | | LiqPay приватний ключ |
| `MONOBANK_TOKEN` | | Monobank API токен |
| `WAYFORPAY_MERCHANT_ACCOUNT` | | WayForPay merchant account |
| `WAYFORPAY_SECRET_KEY` | | WayForPay секретний ключ |

---

## Доставка

| Змінна | Гайд | Опис |
|--------|------|------|
| `NOVA_POSHTA_API_KEY` | [06-delivery-providers.md](06-delivery-providers.md) | API ключ Нової Пошти (v2.0) |
| `UKRPOSHTA_BEARER_TOKEN` | | Bearer токен Укрпошти |

---

## Месенджери та соцмережі

| Змінна | Гайд | Опис |
|--------|------|------|
| `TELEGRAM_BOT_TOKEN` | [03-telegram-bot.md](03-telegram-bot.md) | Токен від @BotFather |
| `TELEGRAM_CHANNEL_ID` | | ID каналу для публікацій |
| `TELEGRAM_MANAGER_CHAT_ID` | | Chat ID менеджера для сповіщень |
| `VIBER_BOT_TOKEN` | [04-viber-bot.md](04-viber-bot.md) | Auth token Viber бота |
| `INSTAGRAM_APP_ID` | [09-instagram.md](09-instagram.md) | Facebook App ID |
| `INSTAGRAM_APP_SECRET` | | Facebook App Secret |
| `INSTAGRAM_ACCESS_TOKEN` | | Instagram access token |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | | Instagram Business Account ID |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | | Токен сторінки Facebook (для постів) |
| `FACEBOOK_PAGE_ID` | | ID сторінки Facebook |

---

## Авторизація

| Змінна | Гайд | Опис |
|--------|------|------|
| `GOOGLE_CLIENT_ID` | [08-google-oauth.md](08-google-oauth.md) | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | | Google OAuth Client Secret |

---

## Email (SMTP)

| Змінна | Гайд | Опис |
|--------|------|------|
| `SMTP_HOST` | [07-email-smtp.md](07-email-smtp.md) | SMTP сервер (smtp.gmail.com) |
| `SMTP_PORT` | | Порт (587 для TLS) |
| `SMTP_USER` | | Email для авторизації |
| `SMTP_PASS` | | Пароль (App Password для Gmail) |
| `SMTP_FROM` | | Email відправника (noreply@...) |

---

## Аналітика та трекінг

| Змінна | Гайд | Опис |
|--------|------|------|
| `GA4_MEASUREMENT_ID` | [12-seo-analytics.md](12-seo-analytics.md) | GA4 Measurement ID (G-XXXXXXXXXX) |
| `GA4_API_SECRET` | | GA4 API Secret для серверного трекінгу |
| `NEXT_PUBLIC_GA4_ID` | | GA4 ID для клієнтського gtag.js |
| `FACEBOOK_PIXEL_ID` | | Facebook Pixel ID (серверний CAPI) |
| `FACEBOOK_CAPI_TOKEN` | | Facebook Conversions API токен |
| `NEXT_PUBLIC_FB_PIXEL_ID` | | Facebook Pixel ID (клієнтський fbevents.js) |

> `NEXT_PUBLIC_*` — змінні доступні на клієнті (в браузері). Без цього префіксу — тільки серверні.

---

## Моніторинг

| Змінна | Гайд | Опис |
|--------|------|------|
| `SENTRY_DSN` | [10-monitoring.md](10-monitoring.md) | Sentry DSN для серверних помилок |
| `NEXT_PUBLIC_SENTRY_DSN` | | Sentry DSN для клієнтських помилок |
| `SENTRY_ENVIRONMENT` | | `production` / `staging` |
| `LOG_LEVEL` | | `debug` / `info` / `warn` / `error` |
| `AXIOM_TOKEN` | | Axiom API токен (хмарні логи) |
| `AXIOM_DATASET` | | Назва датасету в Axiom |

---

## Push-сповіщення

| Змінна | Гайд | Опис |
|--------|------|------|
| `VAPID_PUBLIC_KEY` | [13-push-notifications.md](13-push-notifications.md) | VAPID публічний ключ |
| `VAPID_PRIVATE_KEY` | | VAPID приватний ключ |
| `VAPID_EMAIL` | | Email для VAPID (mailto:...) |

> Генерація: `npx web-push generate-vapid-keys`

---

## Хмарне сховище (Cloudflare R2)

| Змінна | Гайд | Опис |
|--------|------|------|
| `R2_ACCOUNT_ID` | [cloudflare/setup-guide.md](cloudflare/setup-guide.md) | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | | R2 API Access Key |
| `R2_SECRET_ACCESS_KEY` | | R2 API Secret Key |
| `R2_BUCKET` | | Назва бакету (clean-media) |
| `R2_PUBLIC_URL` | | Публічний URL (https://media.poroshok.com) |

---

## Системні

| Змінна | За замовчуванням | Опис |
|--------|-----------------|------|
| `MAINTENANCE_MODE` | `false` | `true` — увімкнути режим обслуговування (всі сторінки → /maintenance) |

> Також можна увімкнути через адмін-панель: POST /api/v1/admin/maintenance

---

## Docker Compose змінні

Ці змінні потрібні для `docker-compose.yml`:

| Змінна | Опис |
|--------|------|
| `POSTGRES_USER` | Логін PostgreSQL (default: `clean_user`) |
| `POSTGRES_PASSWORD` | **Обов'язково** — пароль PostgreSQL |
| `POSTGRES_DB` | Назва БД (default: `clean_shop`) |
| `TYPESENSE_API_KEY` | **Обов'язково** — API ключ Typesense |
