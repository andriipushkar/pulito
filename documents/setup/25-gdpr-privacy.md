# 25 — GDPR / Privacy

Налаштування cookie consent banner, експорту даних користувача та видалення акаунту.

## Крок 1 — Cookie Consent Banner

Cookie consent вже реалізовано через `/api/v1/cookie-consent`. Налаштування через адмін-панель: **Налаштування → Privacy**.

### Категорії cookies

| Категорія | Обов'язкові | Приклади |
|-----------|-------------|---------|
| Necessary | Так (завжди активні) | Session, CSRF token, cart |
| Analytics | Ні | GA4, Facebook Pixel |
| Marketing | Ні | Facebook CAPI, remarketing |
| Preferences | Ні | Мова, валюта, тема |

### Змінні оточення

```env
# Cookie consent
COOKIE_CONSENT_ENABLED=true
COOKIE_BANNER_POSITION=bottom
COOKIE_POLICY_URL=/privacy-policy
```

### CSP reporting (збір порушень Content-Security-Policy)

```env
SENTRY_CSP_REPORT_URI=https://o123456.ingest.sentry.io/api/123456/security/?sentry_key=abc123
```

Це надсилає CSP-violation звіти в Sentry для моніторингу.

## Крок 2 — Data Export (право на портабельність)

Користувач може запросити експорт всіх своїх даних через особистий кабінет або API:

```bash
# Запит на експорт
curl -X POST http://localhost:3000/api/v1/account/data-export \
  -H "Authorization: Bearer USER_TOKEN"

# Відповідь: { "status": "processing", "estimatedMinutes": 5 }
# Коли готово — email з посиланням на завантаження (ZIP)
```

Експорт включає:
- Профіль (ім'я, email, телефон, адреси)
- Історія замовлень
- Збережені товари (wishlist)
- Бали лояльності
- Згоди на обробку даних

Формат: JSON + CSV у ZIP-архіві.

## Крок 3 — Account Self-Deletion (право на забуття)

Користувач може видалити свій акаунт:

```bash
curl -X DELETE http://localhost:3000/api/v1/account \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "password": "confirmation-password" }'
```

Процес видалення:

1. **Негайно:** Акаунт деактивується, сесії інвалідуються
2. **30 днів:** Період відновлення (користувач може звернутись в підтримку)
3. **Після 30 днів:** Cron `cleanup-soft-deleted` безповоротно видаляє дані

> Замовлення зберігаються в анонімізованому вигляді для бухгалтерського обліку.

## Крок 4 — Retention Policies

| Дані | Термін зберігання | Підстава |
|------|-------------------|----------|
| Акаунт після soft-delete | 30 днів | Можливість відновлення |
| Замовлення | 3 роки (анонімізовані) | Бухгалтерія / податки |
| Логи сесій | 90 днів | Безпека |
| Analytics дані | 26 місяців | GA4 retention policy |
| Покинуті кошики | 30 днів | Маркетинг |
| Email підписка після відписки | Видаляється | GDPR |

Cron `cleanup-soft-deleted` (щоденно о 05:00, налаштовано в [02-production-vps.md](02-production-vps.md)) автоматично видаляє записи після закінчення retention period.

## Крок 5 — Сторінка Privacy Policy

Створіть сторінку `/privacy-policy` через адмін-панель: **Контент → Сторінки → Створити**.

Обов'язковий зміст:
- Які дані збираються і навіщо
- Як обробляються (правова підстава)
- З ким діляться (аналітика, платіжні провайдери)
- Права користувача (доступ, видалення, портабельність)
- Контактні дані відповідального

## Крок 6 — Чекліст відповідності

- [ ] Cookie consent banner увімкнено
- [ ] Аналітика працює тільки після згоди
- [ ] Data export працює і включає всі дані
- [ ] Видалення акаунту доступне в кабінеті
- [ ] Soft-deleted записи очищаються cron-ом
- [ ] Privacy Policy сторінка створена
- [ ] Форма реєстрації має чекбокс згоди на обробку даних

## Troubleshooting

| Проблема | Рішення |
|----------|---------|
| Banner не з'являється | Перевірте `COOKIE_CONSENT_ENABLED=true` |
| GA4 працює без згоди | Перевірте що `gtag('consent', 'default', ...)` налаштовано на `denied` |
| Data export порожній | Перевірте що користувач авторизований і має дані |
| Акаунт не видаляється | Перевірте що пароль підтвердження правильний |
| Soft-deleted дані не очищаються | Перевірте cron `cleanup-soft-deleted` в `crontab -l` |
