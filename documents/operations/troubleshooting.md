# Вирішення типових проблем

## 1. Помилки збірки (Build Failures)

### Prisma Client не знайдено
**Симптоми:** `Cannot find module '@/../generated/prisma'`

**Рішення:**
```bash
npx prisma generate
```
Переконайтесь, що `output` в `schema.prisma` вказує на `../generated/prisma`.

### Помилки типів TypeScript
**Симптоми:** Помилки компіляції після зміни schema

**Рішення:**
```bash
npx prisma generate
npx tsc --noEmit  # перевірка типів
```

### Next.js Build помилки
**Симптоми:** `Error: Build optimization failed`

**Рішення:**
1. Очистіть кеш: `rm -rf .next`
2. Перевірте `next.config.ts` на коректність
3. Перевірте всі env-змінні (див. `docs/environments.md`)

---

## 2. Міграції бази даних

### Міграція не застосовується
**Симптоми:** `prisma migrate dev` зависає або падає

**Рішення:**
```bash
# Перевірте підключення до БД
psql $DATABASE_URL -c "SELECT 1"

# Скиньте стан міграції (тільки dev!)
npx prisma migrate reset

# Застосуйте міграції
npx prisma migrate dev
```

### Конфлікт міграцій
**Симптоми:** `Migration is already applied but missing from local file system`

**Рішення:**
```bash
# Позначте міграцію як розв'язану
npx prisma migrate resolve --applied <migration_name>
```

### Production міграції
```bash
# Тільки застосування (без генерації нових)
npx prisma migrate deploy
```

---

## 3. Змінні оточення

### Відсутні обов'язкові змінні
**Симптоми:** `Invalid environment variables` при запуску

**Рішення:**
Перевірте наявність обов'язкових змінних в `.env`:
```
DATABASE_URL=postgresql://user:pass@localhost:5432/clean
JWT_SECRET=<мінімум 16 символів>
```

Валідація виконується в `src/config/env.ts` через Zod-схему.

### Типові помилки
| Змінна | Помилка | Рішення |
|--------|---------|---------|
| `JWT_SECRET` | `String must contain at least 16 character(s)` | Встановіть секрет >= 16 символів |
| `DATABASE_URL` | `String must contain at least 1 character(s)` | Вкажіть повний connection string |
| `APP_URL` | `Invalid url` | Використовуйте повний URL з протоколом |

---

## 4. Redis

### Помилка з'єднання
**Симптоми:** `ECONNREFUSED 127.0.0.1:6380`

**Рішення:**
```bash
# Перевірте, що Redis запущено
redis-cli -p 6380 ping

# Або запустіть
redis-server --port 6380

# Docker
docker run -d -p 6380:6379 redis:7
```

### Redis використовується для
- Blacklist access-токенів (prefix `bl:`)
- Токени верифікації email (prefix `verify:`, TTL 24h)
- Токени скидання пароля (prefix `reset:`, TTL 1h)
- Прив'язка Telegram (prefix `tg_link:`, TTL 10 хв)
- Прив'язка Viber (prefix `viber:link:`, TTL 10 хв)
- Пагінація каталогу Viber (prefix `viber:catalog_page:`, TTL 1h)
- Кешування даних (prefix залежить від сервісу)

---

## 5. Завантаження зображень

### Помилки upload
**Симптоми:** `413 Request Entity Too Large` або `File too large`

**Рішення:**
1. Перевірте `MAX_FILE_SIZE` (за замовчуванням 10 MB)
2. Перевірте конфігурацію reverse proxy (nginx: `client_max_body_size`)
3. Перевірте, що `UPLOAD_DIR` існує та має права на запис:
```bash
mkdir -p ./uploads
chmod 755 ./uploads
```

### Зображення не відображаються
- Перевірте, що `UPLOAD_DIR` доступний через web-сервер
- Перевірте шляхи в `ProductImage` (pathOriginal, pathFull, pathMedium, pathThumbnail)
- Переконайтесь, що обробка зображень (sharp) встановлена коректно

---

## 6. Надсилання email

### Помилки SMTP
**Симптоми:** `Error: Invalid login`, `ECONNREFUSED`

**Рішення для Gmail:**
1. Увімкніть "Less secure apps" або створіть App Password
2. Перевірте налаштування:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=<app-password>
SMTP_FROM="Clean Shop <your@gmail.com>"
```

**Рішення для інших провайдерів:**
- Порт 587: STARTTLS (рекомендовано)
- Порт 465: SSL/TLS
- Порт 25: без шифрування (не рекомендовано)

### Email з retry
Сервіс email автоматично робить до 3 спроб з exponential backoff. Якщо всі спроби невдалі, кидається `EmailError`.

---

## 7. Cron Jobs

### Заплановані задачі не запускаються

**Задачі, які потрібно налаштувати:**
1. **Обробка черги сповіщень:** `processNotificationQueue()` -- надсилання email/Telegram/Viber/Push
2. **Очищення прострочених сповіщень:** `cleanupExpiredNotifications()` -- видалення прочитаних старше 90 днів
3. **Публікація запланованого контенту:** обробка публікацій зі статусом `scheduled` та `scheduledAt <= now()`
4. **Агрегація DailyFunnelStats:** збір аналітики з ClientEvent
5. **Очищення прострочених refresh-токенів**

**Рішення:**
```bash
# Використовуйте cron або systemd timer
# Приклад crontab:
*/5 * * * * curl -s http://localhost:3000/api/v1/cron/notifications
0 * * * * curl -s http://localhost:3000/api/v1/cron/cleanup
*/1 * * * * curl -s http://localhost:3000/api/v1/cron/publications
0 3 * * * curl -s http://localhost:3000/api/v1/cron/analytics
```

Переконайтесь, що cron endpoint-и захищені секретним ключем (`APP_SECRET`).

---

## 8. Проблеми з продуктивністю

### Повільний пошук товарів
- Перевірте, що tsvector стовпець `search_vector` індексований
- Перевірте наявність розширення `pg_trgm` для fuzzy-пошуку
- Використовуйте `EXPLAIN ANALYZE` для діагностики

### Повільні запити до БД
```sql
-- Перевірте, що всі індекси створені
SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public';
```

### Кешування
Проект використовує Redis-кешування з TTL:
- `CACHE_TTL.SHORT` -- автокомплект, часті запити
- `CACHE_TTL.MEDIUM` -- списки продуктів
- `CACHE_TTL.LONG` -- деталі продукту

Інвалідація: `cacheInvalidate('products:*')` при зміні даних.

---

## 9. CORS та Security

### CORS помилки
Перевірте конфігурацію в `next.config.ts` та middleware.

### CSRF
Refresh-токен передається через httpOnly cookie. Access-токен -- через Authorization header.

---

## 10. Maintenance Mode

Для ввімкнення режиму обслуговування:
```
MAINTENANCE_MODE=true
```
Користувачі будуть перенаправлені на `/maintenance`.
