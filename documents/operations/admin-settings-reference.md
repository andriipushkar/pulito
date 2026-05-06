# Довідник admin-налаштувань (DB SiteSettings)

Усі ключі зберігаються в таблиці `siteSetting` (key → value, обидва `String`). Доступ через адмін-панель або API `/api/v1/admin/*-settings`.

DB-настройки **мають пріоритет над env-змінними** (де це підтримується). При збереженні автоматично інвалідується кеш `getSettings()`.

## Загальна інформація про магазин

| Ключ                  | Тип    | Default                     | Опис                                          |
| --------------------- | ------ | --------------------------- | --------------------------------------------- |
| `site_name`           | string | `Pulito Trade`              | Назва магазину (header, footer, email, OG)    |
| `site_phone`          | string | `+380001234567`             | Телефон у міжнародному форматі (для дзвінків) |
| `site_phone_display`  | string | `+38 (000) 123-45-67`       | Форматований телефон для відображення         |
| `site_email`          | string | `info@pulito.trade`         | Контактний email                              |
| `site_address`        | string | `м. Київ, вул. Хрещатик, 1` | Юридична адреса                               |
| `working_hours`       | string | `Пн-Пт: 9:00 - 18:00, ...`  | Графік роботи (footer)                        |
| `company_description` | string | (default markdown)          | Опис компанії (footer, OG)                    |
| `maintenance_mode`    | string | `false`                     | `true` — увімкнути режим обслуговування       |

**Адмін-панель**: `/admin/settings` (`/api/v1/admin/settings`).

## B2B / Юридичні реквізити

Використовуються в інвойсах, на сторінці контактів, у договорах для оптових клієнтів.

| Ключ                    | Тип    | Опис                                  |
| ----------------------- | ------ | ------------------------------------- |
| `company_legal_name`    | string | Юридична назва (`ТОВ «Пуліто Трейд»`) |
| `company_edrpou`        | string | ЄДРПОУ (8 цифр)                       |
| `company_ipn`           | string | ІПН (12 цифр)                         |
| `company_iban`          | string | IBAN рахунок (для bank_transfer)      |
| `company_bank`          | string | Назва банку                           |
| `company_legal_address` | string | Юридична адреса (для рахунків)        |

## Соцмережі

| Ключ               | Тип    | Опис                     |
| ------------------ | ------ | ------------------------ |
| `social_telegram`  | string | URL Telegram-каналу/чату |
| `social_viber`     | string | Viber Public Account URL |
| `social_instagram` | string | URL Instagram-профілю    |
| `social_facebook`  | string | URL Facebook-сторінки    |
| `social_tiktok`    | string | URL TikTok-профілю       |

## SEO та аналітика

| Ключ                       | Тип    | Опис                                        |
| -------------------------- | ------ | ------------------------------------------- |
| `default_seo_title`        | string | Default `<title>` для сторінок без власного |
| `default_seo_description`  | string | Default meta description                    |
| `google_analytics_id`      | string | GA4 measurement ID (`G-XXXXXXXX`)           |
| `facebook_pixel_id`        | string | Facebook Pixel ID                           |
| `google_maps_api_key`      | string | Google Maps API key (для контактів)         |
| `google_business_place_id` | string | Google Business Place ID (відгуки в footer) |

**Адмін-панель**: `/admin/seo-templates`, `/admin/settings`.

## Платежі

### Online-провайдери

| Ключ                                 | Тип    | Default | Опис                              |
| ------------------------------------ | ------ | ------- | --------------------------------- |
| `payment_liqpay_enabled`             | bool   | `true`  | Toggle LiqPay                     |
| `payment_liqpay_public_key`          | string | —       | Public key (DB > env)             |
| `payment_liqpay_private_key`         | string | —       | Private key (DB > env, sensitive) |
| `payment_liqpay_sandbox`             | bool   | `false` | Sandbox-режим                     |
| `payment_liqpay_paypart_enabled`     | bool   | `false` | "Оплата частинами" (ПриватБанк)   |
| `payment_liqpay_paypart_count`       | number | `3`     | Місяців розстрочки (2-24)         |
| `payment_monobank_enabled`           | bool   | `true`  | Toggle Mono                       |
| `payment_monobank_token`             | string | —       | API token (DB > env, sensitive)   |
| `payment_wayforpay_enabled`          | bool   | `true`  | Toggle WFP                        |
| `payment_wayforpay_merchant_account` | string | —       | Merchant account                  |
| `payment_wayforpay_secret_key`       | string | —       | HMAC secret (sensitive)           |
| `payment_apple_pay_enabled`          | bool   | `true`  | Toggle Apple Pay (auto-routes)    |
| `payment_google_pay_enabled`         | bool   | `true`  | Toggle Google Pay (auto-routes)   |

### Offline-методи

| Ключ                            | Тип    | Default | Опис                                       |
| ------------------------------- | ------ | ------- | ------------------------------------------ |
| `payment_cod_enabled`           | bool   | `true`  | Toggle "Накладений платіж"                 |
| `payment_bank_transfer_enabled` | bool   | `true`  | Toggle "Банківський переказ"               |
| `payment_bank_transfer_details` | string | —       | Реквізити для оплати (показуються клієнту) |
| `payment_card_prepay_enabled`   | bool   | `true`  | Toggle "Передоплата на картку"             |
| `payment_card_prepay_details`   | string | —       | Реквізити картки                           |

### Глобальні параметри

| Ключ                        | Тип    | Опис                                                                                                |
| --------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| `payment_min_online_amount` | number | Мінімальна сума замовлення для онлайн-оплати (грн). Якщо cart < поріг, online-провайдери ховаються. |

**Адмін-панель**: `/admin/payment-settings` (`/api/v1/admin/payment-settings`).
**Сенситивні поля** (private keys, tokens) маскуються при GET — показуються як `abcd••••••••wxyz`.

## Доставка

| Ключ                                        | Тип    | Default | Опис                                                   |
| ------------------------------------------- | ------ | ------- | ------------------------------------------------------ |
| `delivery_nova_poshta_enabled`              | bool   | `true`  | Toggle НП                                              |
| `delivery_nova_poshta_api_key`              | string | —       | API key (DB > env, sensitive)                          |
| `delivery_nova_poshta_sender_ref`           | string | —       | UUID контактної особи відправника                      |
| `delivery_nova_poshta_sender_city_ref`      | string | —       | UUID міста відправника                                 |
| `delivery_nova_poshta_sender_warehouse_ref` | string | —       | UUID відділення відправника                            |
| `delivery_nova_poshta_sender_phone`         | string | —       | Телефон відправника                                    |
| `delivery_nova_poshta_fixed_cost`           | number | —       | Фіксована вартість (грн); порожньо = автомат через API |
| `delivery_ukrposhta_enabled`                | bool   | `true`  | Toggle Укрпошти                                        |
| `delivery_ukrposhta_bearer_token`           | string | —       | Bearer token (DB > env, sensitive)                     |
| `delivery_ukrposhta_sender_name`            | string | —       | ПІБ відправника                                        |
| `delivery_ukrposhta_sender_phone`           | string | —       | Телефон відправника                                    |
| `delivery_ukrposhta_sender_address`         | string | —       | Адреса відправника                                     |
| `delivery_ukrposhta_fixed_cost`             | number | —       | Фіксована вартість                                     |
| `delivery_pickup_enabled`                   | bool   | `true`  | Toggle "Самовивіз"                                     |
| `delivery_pickup_address`                   | string | —       | Адреса пункту видачі (показується клієнту)             |
| `delivery_pickup_hours`                     | string | —       | Графік роботи пункту видачі                            |
| `delivery_pickup_phone`                     | string | —       | Контактний телефон пункту видачі                       |
| `delivery_pallet_enabled`                   | bool   | `true`  | Toggle "Палетна доставка"                              |
| `delivery_free_shipping_threshold`          | number | —       | Поріг безкоштовної доставки (грн); порожньо = вимкнено |

**Адмін-панель**: `/admin/delivery-settings`. Палетна доставка налаштовується окремо в `/admin/pallet-delivery`.

## SMTP / Email

| Ключ          | Тип    | Опис                                        |
| ------------- | ------ | ------------------------------------------- |
| `smtp_host`   | string | SMTP-сервер (наприклад `smtp.gmail.com`)    |
| `smtp_port`   | number | Порт (587 для TLS, 465 для SSL)             |
| `smtp_user`   | string | Логін / email                               |
| `smtp_pass`   | string | Пароль / App Password (sensitive)           |
| `smtp_from`   | string | Адреса відправника (`"Магазин" <noreply@>`) |
| `smtp_secure` | bool   | `true` для SSL / `false` для TLS            |

**Адмін-панель**: `/admin/smtp-settings`.

## Канали сповіщень (Telegram/Viber)

| Ключ                       | Тип    | Опис                            |
| -------------------------- | ------ | ------------------------------- |
| `telegram_bot_token`       | string | Bot token від @BotFather        |
| `telegram_channel_id`      | string | ID каналу для публікацій        |
| `telegram_manager_chat_id` | string | Chat ID менеджера для сповіщень |
| `viber_pa_auth_token`      | string | Viber Public Account auth token |

**Адмін-панель**: `/admin/channel-settings`.

## Інтеграції

### Instagram

| Ключ                            | Тип    | Опис                                 |
| ------------------------------- | ------ | ------------------------------------ |
| `instagram_access_token`        | string | Long-lived access token              |
| `instagram_business_account_id` | string | IG Business Account ID               |
| `instagram_app_id`              | string | App ID з Facebook Developer          |
| `instagram_app_secret`          | string | App secret (sensitive)               |
| `instagram_daily_post_quota`    | number | Денний quota (default 25, для guard) |

### Google OAuth

| Ключ                   | Тип    | Опис                |
| ---------------------- | ------ | ------------------- |
| `google_client_id`     | string | OAuth Client ID     |
| `google_client_secret` | string | OAuth Client Secret |

### Marketplaces

| Ключ                         | Тип    | Опис                      |
| ---------------------------- | ------ | ------------------------- |
| `marketplace_olx_token`      | string | OLX API token             |
| `marketplace_rozetka_token`  | string | Rozetka Marketplace token |
| `marketplace_prom_token`     | string | Prom.ua API token         |
| `marketplace_epicentr_token` | string | Epicentr API token        |

## Image processing

| Змінна (env)        | Default        | Опис                              |
| ------------------- | -------------- | --------------------------------- |
| `WATERMARK_ENABLED` | `true`         | `false` — вимкнути watermark      |
| `WATERMARK_TEXT`    | `pulito.trade` | Текст водяного знаку              |
| `REMOVEBG_API_KEY`  | —              | Опційно — для авто-видалення фону |

R2 cloud storage (опційно):

| Змінна                 | Опис                  |
| ---------------------- | --------------------- |
| `R2_ACCOUNT_ID`        | Cloudflare account ID |
| `R2_ACCESS_KEY_ID`     | S3 access key         |
| `R2_SECRET_ACCESS_KEY` | S3 secret key         |
| `R2_BUCKET`            | Назва bucket          |
| `R2_PUBLIC_URL`        | CDN public URL        |

## Лояльність

| Ключ                        | Тип    | Default | Опис                             |
| --------------------------- | ------ | ------- | -------------------------------- |
| `loyalty_enabled`           | bool   | `true`  | Toggle програми лояльності       |
| `loyalty_points_per_uah`    | number | `1`     | Балів за 1 грн                   |
| `loyalty_uah_per_point`     | number | `1`     | Грн при списанні балу            |
| `loyalty_max_spend_percent` | number | `30`    | Максимум % від замовлення балами |
| `loyalty_referral_bonus`    | number | `100`   | Бонус рефереру за першу покупку  |

## Feature flags

| Ключ                            | Тип  | Опис                         |
| ------------------------------- | ---- | ---------------------------- |
| `feature_wholesale_enabled`     | bool | Гуртові ціни                 |
| `feature_loyalty_enabled`       | bool | Програма лояльності          |
| `feature_blog_enabled`          | bool | Блог                         |
| `feature_marketplace_sync`      | bool | Синхронізація з marketplaces |
| `feature_subscriptions_enabled` | bool | Підписки на товари           |

Повний список — `documents/setup/24-feature-flags.md`.

## Кеш і оновлення

Усі settings кешуються:

1. **In-memory cache** (60 sec TTL) — для уникнення hot-path БД-запитів
2. **Redis cache** (5 min TTL) — для розподілу між instances

При збереженні через admin-роути викликається `invalidateSettingsCache()` — обидва кеші очищаються миттєво. У DEV-режимі якщо змінюєш через `prisma studio` чи sql — потрібно перезапустити сервер або викликати:

```bash
curl -X POST -H "Authorization: Bearer $APP_SECRET" \
  https://shop.example.com/api/v1/admin/cache/invalidate
```

## Безпека

- Sensitive ключі (API keys, tokens, passwords) при `GET` маскуються (`abcd••••••••wxyz`)
- При `PUT` маскований value (з `••••`) **ігнорується** — не перезаписує оригінал
- Усі admin-routes захищені `withRole('admin')` або `withRole('admin', 'manager')`

Якщо треба змінити sensitive значення — впиши **повне** нове значення в адмінці; маскований placeholder автоматично пропускається.

## Експорт / імпорт settings

Для швидкого міграції налаштувань між environments:

```bash
# Експорт
psql $DATABASE_URL -c "COPY (SELECT key, value FROM site_settings) TO STDOUT WITH CSV HEADER" > settings.csv

# Імпорт
psql $DATABASE_URL -c "TRUNCATE site_settings; COPY site_settings (key, value) FROM STDIN WITH CSV HEADER" < settings.csv
```

Sensitive ключі при цьому переносяться як plaintext — обережно з правами на файл.
