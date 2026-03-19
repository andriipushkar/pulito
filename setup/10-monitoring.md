# Моніторинг та логування

## Sentry — відстеження помилок

Sentry відловлює JavaScript-помилки на клієнті та сервері.

### Крок 1 — Реєстрація

1. Перейдіть на **https://sentry.io/**
2. Зареєструйтесь (безкоштовний план — 5K подій/місяць)

### Крок 2 — Створити проєкт

1. **Projects** → **Create Project**
2. Оберіть платформу: **Next.js**
3. Введіть назву: `clean-shop`
4. Натисніть **Create Project**
5. Скопіюйте **DSN** (формат: `https://xxx@xxx.ingest.sentry.io/xxx`)

### Крок 3 — Додати в .env

```env
SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@oXXXXXX.ingest.sentry.io/XXXXXXX
NEXT_PUBLIC_SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@oXXXXXX.ingest.sentry.io/XXXXXXX
SENTRY_ENVIRONMENT=production
```

> `SENTRY_DSN` та `NEXT_PUBLIC_SENTRY_DSN` — однакове значення. Перше для серверних помилок, друге для клієнтських.

### Крок 4 — Перевірити

Перезапустіть додаток і перевірте в дашборді Sentry, що проєкт отримує дані.

---

## Axiom — централізоване логування

Axiom збирає всі логи додатку в одному місці з пошуком та аналітикою.

### Крок 1 — Реєстрація

1. Перейдіть на **https://axiom.co/**
2. Зареєструйтесь (безкоштовний план — 500 MB/місяць)

### Крок 2 — Створити Dataset

1. **Datasets** → **New Dataset**
2. Назва: `clean-shop`
3. Натисніть **Create**

### Крок 3 — Створити API Token

1. **Settings** → **API Tokens** → **New API Token**
2. Назва: `clean-shop-production`
3. Права: **Ingest** для датасету `clean-shop`
4. Натисніть **Create**
5. Скопіюйте токен

### Крок 4 — Додати в .env

```env
AXIOM_TOKEN=xaat-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AXIOM_DATASET=clean-shop
```

### Крок 5 — Перевірити

Після перезапуску додатку логи мають з'являтися в Axiom Dashboard.

---

## PM2 — моніторинг процесів

PM2 вже встановлений як менеджер процесів. Корисні команди:

```bash
# Статус всіх процесів
pm2 status

# Моніторинг в реальному часі (CPU, Memory, Logs)
pm2 monit

# Переглянути логи
pm2 logs clean-shop

# Переглянути останні 100 рядків логів
pm2 logs clean-shop --lines 100

# Переглянути тільки помилки
pm2 logs clean-shop --err

# Інформація про процес
pm2 describe clean-shop

# Перезапустити при високому споживанні пам'яті
# (вже налаштовано: max_memory_restart: '512M')
```

### PM2 Web Dashboard (опціонально)

```bash
# Зареєструйтесь на https://app.pm2.io/
pm2 link <secret_key> <public_key>
```

Це дає веб-інтерфейс для моніторингу з будь-якого місця.

---

## Health Check

Перевірка стану додатку:

```bash
curl http://localhost:3000/api/v1/health
```

Очікувана відповідь:

```json
{
  "status": "ok",
  "uptime": 12345,
  "timestamp": "2026-03-19T12:00:00.000Z"
}
```

Використовуйте для:
- Перевірок від UptimeRobot
- Моніторингу в Nginx
- Kubernetes liveness/readiness probes

---

## UptimeRobot — моніторинг доступності

Безкоштовний сервіс, що перевіряє доступність сайту кожні 5 хвилин.

### Крок 1 — Реєстрація

1. Перейдіть на **https://uptimerobot.com/**
2. Зареєструйтесь (безкоштовний план — 50 моніторів)

### Крок 2 — Додати монітор

1. **Add New Monitor**
2. Тип: **HTTP(s)**
3. Friendly Name: `Clean Shop`
4. URL: `https://yourdomain.com/api/v1/health`
5. Monitoring Interval: **5 minutes**
6. Натисніть **Create Monitor**

### Крок 3 — Налаштувати сповіщення

1. **Alert Contacts** → **Add Alert Contact**
2. Додайте:
   - **Email** — ваш email
   - **Telegram** — через інтеграцію UptimeRobot
3. Прив'яжіть сповіщення до монітору

Тепер ви отримаєте сповіщення, коли сайт стане недоступним.

---

## Розташування логів

| Сервіс | Розташування |
|--------|-------------|
| PM2 логи | `~/.pm2/logs/` |
| Nginx access log | `/var/log/nginx/access.log` |
| Nginx error log | `/var/log/nginx/error.log` |
| PostgreSQL | `/var/log/postgresql/` (або Docker logs) |
| Docker логи | `docker compose logs <service>` |

### Перегляд Docker-логів

```bash
# Всі сервіси
docker compose logs -f

# Конкретний сервіс
docker compose logs -f postgres
docker compose logs -f redis
docker compose logs -f typesense
```
