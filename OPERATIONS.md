# 📘 Операційне підключення Pulito Trade

Покрокова інструкція для налаштування всіх інтеграцій, ENV-vars, cron-задач, бекапів і моніторингу.

> **Як користуватися:** виконуй розділи по черзі. Кожен незалежний — можна підключити, що потрібно зараз, решту відкласти.

---

## 0. Передумови

Усі команди виконуються з-під користувача `pulitotrade` на сервері. Файл `.env` лежить у `/home/pulitotrade/pulito/.env`.

```bash
# Перейти в проєкт
cd /home/pulitotrade/pulito

# Подивитись поточні env (для довідки, не редагуй вручну якщо не треба)
cat .env | grep -E "TELEGRAM|NOVA_POSHTA|GA4|APP_SECRET"
```

**Правило:** після зміни `.env` потрібен **rebuild + restart**:

```bash
npm run build && pm2 restart pulito
```

Винятки (тільки restart, без rebuild):

- Server-only змінні (TELEGRAM*\*, NOVA_POSHTA_API_KEY, SMTP*\*, payment keys)

Потребують **rebuild**:

- Усі `NEXT_PUBLIC_*` (вони bake-яться в bundle)
- Структурні зміни (нові env), що читаються у server components

---

## 1. 🟦 Google Analytics 4

### Що отримати

**Measurement ID** виду `G-XXXXXXXXXX`.

### Як отримати

1. Відкрий https://analytics.google.com
2. Створи **Account** (якщо ще нема) → **Property** → **Web data stream** для `https://pulito.trade`
3. У створеному data stream побачиш **Measurement ID** (G-…)

### Як підключити

```bash
nano /home/pulitotrade/pulito/.env

# Знайти/додати рядок (заміни на свій ID):
NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX

# Зберегти (Ctrl+O, Enter, Ctrl+X)

# Перебілдити і перезапустити
cd /home/pulitotrade/pulito && npm run build && pm2 restart pulito
```

### Як перевірити

1. Відкрий магазин у браузері → DevTools → Network → фільтр `google-analytics` або `collect`
2. Зайди на товар — побачиш `view_item` event
3. Додай у кошик — побачиш `add_to_cart`
4. У GA4: **Reports → Realtime** покаже активних користувачів за 30 секунд

---

## 2. 🟪 Telegram-сповіщення про нові замовлення

### Що отримати

- `TELEGRAM_BOT_TOKEN` — токен бота
- `TELEGRAM_MANAGER_CHAT_ID` — твій chat ID (або групи)

### Як отримати

**Крок 2.1 — створити бота:**

1. У Telegram знайди `@BotFather`
2. `/newbot` → введи назву (наприклад «Pulito Manager») → username (`pulito_manager_bot`)
3. BotFather видасть токен типу `8123456789:AAH...` — **зберегти**

**Крок 2.2 — дізнатися свій chat_id:**

1. У Telegram знайди `@userinfobot` → надішли йому будь-яке повідомлення
2. Він покаже твій ID, типу `123456789` — **зберегти**

**Альтернативно (для групи):**

1. Створи групу «Pulito замовлення», додай свого бота
2. Надішли в групу будь-яке повідомлення
3. Відкрий `https://api.telegram.org/bot<TOKEN>/getUpdates` у браузері (заміни `<TOKEN>`)
4. Знайди `"chat":{"id":-100123...` — це chat_id групи (від'ємний)

### Як підключити

```bash
nano /home/pulitotrade/pulito/.env

# Заповнити:
TELEGRAM_BOT_TOKEN=8123456789:AAH_твій_токен
TELEGRAM_MANAGER_CHAT_ID=123456789

# Перезапустити
cd /home/pulitotrade/pulito && pm2 restart pulito
# (rebuild не потрібен — це server-only змінні)
```

### Як перевірити

- Створи тестове замовлення на pulito.trade — у Telegram має прийти повідомлення з номером, сумою, контактом

---

## 3. 🟧 Nova Poshta API

### Що отримати

**API ключ** з особистого кабінету НП (безкоштовно).

### Як отримати

1. Залогінься на https://my.novaposhta.ua
2. **Налаштування → Безпека → API**
3. Створити новий ключ → скопіювати (формат `c4d6c4e8a...`)

### Як підключити

```bash
nano /home/pulitotrade/pulito/.env

NOVA_POSHTA_API_KEY=c4d6c4e8a_твій_ключ

cd /home/pulitotrade/pulito && pm2 restart pulito
```

### Як перевірити

1. Відкрий https://pulito.trade/checkout (потрібно хоч 1 товар у кошику)
2. На кроці «Доставка» обери «Нова Пошта»
3. Введи «Київ» — має з'явитись список міст
4. Обери місто — підвантажаться відділення

---

## 4. ⚙️ Cron-задачі

Зараз встановлено лише `backup.sh`. Треба додати решту. Усі endpoints вимагають `Authorization: Bearer $APP_SECRET`.

### Як підключити

```bash
crontab -e
```

Додай блок (адаптовано під вашу інфраструктуру):

```cron
# ─── PULITO CRONS ─────────────────────────────────────────────
# Завантаж APP_SECRET у середовище cron (читає з .env)
APP_SECRET=6079c1720da52330dbf434d69736a8a70a517f0af24f8e39c0c0fe3ce03e4b27
BASE=http://localhost:3000

# ── Існуючий бекап БД ──
0 3 * * * /home/pulitotrade/backup.sh

# ── Нічні (важкі) ──
0  3 * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" $BASE/api/v1/cron/precompute-analytics
30 3 * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" $BASE/api/v1/cron/reindex-products
0  4 * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" $BASE/api/v1/cron/seo-check

# ── Кожну годину ──
0  * * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" $BASE/api/v1/cron/cleanup-tokens
0  * * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" $BASE/api/v1/cron/auto-cancel
0  * * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" $BASE/api/v1/cron/notifications
15 * * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" $BASE/api/v1/cron/back-in-stock
30 * * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" $BASE/api/v1/cron/process-subscriptions

# ── Кожні 15 хв ──
*/15 * * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" $BASE/api/v1/cron/auto-tracking
*/15 * * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" $BASE/api/v1/cron/analytics-alerts

# ── Кожні 5 хв ── (вибірка supplier-channels, чий scheduleCron uchodit зараз)
*/5 * * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" $BASE/api/v1/cron/sync-supplier-channels

# ── Кожні 6 годин ──
0 */6 * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" $BASE/api/v1/cron/cleanup-carts

# ── Щоранку о 6:00 ──
0 6 * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" $BASE/api/v1/cron/analytics-digest

# ── Щоранку о 9:00 ── (нагадування про підписки за день + sweep невдалих платежів)
0 9 * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" $BASE/api/v1/cron/subscription-reminders

# ── Щонеділі о 4:00 ── (прострочення балів лояльності за політикою LoyaltyLevel.pointsExpiryMonths)
0 4 * * 0 curl -s -X POST -H "Authorization: Bearer $APP_SECRET" $BASE/api/v1/cron/expire-loyalty
```

Збережи. Перевір:

```bash
crontab -l                                      # переконатись, що крон записався
sudo systemctl status cron                      # cron-сервіс активний?
sudo tail -f /var/log/syslog | grep CRON        # дивись як виконуються
```

### Як перевірити вручну (без чекати години)

```bash
APP_SECRET=$(grep '^APP_SECRET=' /home/pulitotrade/pulito/.env | cut -d= -f2)
curl -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/back-in-stock
# Має повернути: {"success":true,"data":{"scanned":0,"notified":0,"failed":0}}
```

---

## 5. 📧 Email/SMTP

Для роботи back-in-stock сповіщень, email-кампаній, чеків замовлень.

### Що отримати

SMTP-доступи (Gmail App Password / SendGrid / Mailtrap / власний SMTP).

### Як отримати (Gmail як приклад)

1. У Gmail → налаштування акаунту → Безпека → **App Passwords** (потрібен увімкнений 2FA)
2. Створити пароль «Mail / Pulito Trade» → скопіювати 16-символьний пароль

### Як підключити

```bash
nano /home/pulitotrade/pulito/.env
```

Додай (або відкоригуй існуючі):

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=твій_email@gmail.com
SMTP_PASS=твій_app_password
SMTP_FROM=твій_email@gmail.com
SMTP_FROM_NAME=Pulito Trade
```

Restart:

```bash
pm2 restart pulito
```

### Як перевірити

1. Admin → **Email-шаблони → Тест відправка** на свій email
2. Або з консолі:
   ```bash
   APP_SECRET=$(grep '^APP_SECRET=' /home/pulitotrade/pulito/.env | cut -d= -f2)
   curl -X POST -H "Authorization: Bearer $APP_SECRET" \
        -H "Content-Type: application/json" \
        -d '{"to":"твій@email.com"}' \
        http://localhost:3000/api/v1/admin/email-templates/1/test
   ```

---

## 6. 🔍 Sentry (моніторинг помилок)

### Що отримати

**DSN** з https://sentry.io (безкоштовно до 5k подій/міс).

### Як отримати

1. Створи акаунт на sentry.io
2. **Create Project → Platform: Next.js** → введи назву (pulito)
3. У налаштуваннях проєкту → **Client Keys (DSN)** → скопіюй

### Як підключити

```bash
nano /home/pulitotrade/pulito/.env

NEXT_PUBLIC_SENTRY_DSN=https://abc123@o12345.ingest.sentry.io/67890
SENTRY_DSN=https://abc123@o12345.ingest.sentry.io/67890
SENTRY_ENVIRONMENT=production

cd /home/pulitotrade/pulito && npm run build && pm2 restart pulito
```

### Як перевірити

Відкрий неіснуючу сторінку `/abracadabra` — у Sentry панелі за хвилину з'явиться 404-подія.

---

## 7. 🗄️ Backup бази даних

### Перевір що працює

```bash
# Запустити вручну
bash /home/pulitotrade/backup.sh

# Подивитися чи створились файли
ls -la /backups/db/ | tail -5
```

### Якщо ще не налаштовано

```bash
cat > /home/pulitotrade/backup.sh <<'EOF'
#!/bin/bash
set -e
mkdir -p /backups/db
PG_USER=pulito_user
DB=pulito_trade
TS=$(date +%Y%m%d_%H%M%S)
pg_dump -U "$PG_USER" -h localhost "$DB" | gzip > "/backups/db/${DB}_${TS}.sql.gz"
# Залишити останні 30 днів
find /backups/db -name "*.sql.gz" -mtime +30 -delete
EOF
chmod +x /home/pulitotrade/backup.sh
```

### Як перевірити свіжість

В адмінці на дашборді віджет «BackupStatus» покаже коли був останній бекап.

---

## 8. 💳 Платіжні системи (КРИТИЧНО)

### 8.1 LiqPay (від ПриватБанку)

1. Зареєструйся на https://www.liqpay.ua → створи магазин
2. Налаштування магазину → **API**: побачиш `public_key` і `private_key`

```bash
LIQPAY_PUBLIC_KEY=i123456789
LIQPAY_PRIVATE_KEY=твій_private_key
```

### 8.2 Monobank Acquiring

1. Залогінься у Monobank Web (https://web.monobank.ua) → **Еквайринг**
2. Створи токен інтеграції

```bash
MONOBANK_TOKEN=u_xxxxxxxxxxxxxxxxxxxxx
```

### 8.3 WayForPay

1. https://merchant.wayforpay.com → **Налаштування → API**

```bash
WAYFORPAY_MERCHANT_ACCOUNT=твій_акаунт
WAYFORPAY_SECRET_KEY=твій_секрет
```

> **Який обрати?** Якщо тільки починаєш — **Monobank Acquiring** (найпростіша інтеграція, низька комісія). LiqPay — найпопулярніший, але комісія вища. Достатньо одного.

---

## 9. 🚚 Укрпошта (друга служба доставки)

1. https://dev.ukrposhta.ua → реєстрація → **API token** (production)

```bash
UKRPOSHTA_BEARER_TOKEN=твій_bearer_token
```

---

## 10. 🔔 Push-сповіщення (PWA)

Для браузерних push. Потрібні **VAPID-ключі**.

```bash
# Згенерувати ключі (один раз)
npx web-push generate-vapid-keys
```

Виведе `Public Key` і `Private Key`. Підстав:

```bash
VAPID_PUBLIC_KEY=BA...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=mailto:noreply@pulito.trade
```

Без них push-сповіщення (`/account/notifications` web push) працювати не будуть.

---

## 11. 🔍 Typesense (пошуковий сервер)

Якщо встановлений локально:

```bash
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_API_KEY=ts-pulito-prod-key-$(openssl rand -hex 16)
TYPESENSE_PROTOCOL=http
```

**Перевір що Typesense запущений:**

```bash
curl http://localhost:8108/health
# {"ok":true} — все ок
```

Якщо ні — `docker compose up -d typesense` (якщо є у `docker-compose.yml`).

Без Typesense пошук на сайті працює через PostgreSQL (повільніший і без fuzzy-search), але працює.

---

## 12. ⚡ Redis (кеш / sessions)

```bash
REDIS_URL=redis://localhost:6380/0
```

Перевір:

```bash
redis-cli -p 6380 ping  # має повернути PONG
```

Якщо Redis не встановлено — `apt install redis-server` + увімкнути systemd сервіс. Без Redis частина rate-limit і cart-recovery працює гірше.

---

## 13. 🔐 JWT secret (КРИТИЧНО)

Для підпису токенів автентифікації — мусить бути встановлений.

```bash
# Згенерувати випадковий
echo "JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')" >> /tmp/jwt.txt
cat /tmp/jwt.txt

# Підставити в .env
nano .env
# JWT_SECRET=...
```

> **УВАГА:** якщо вже стоїть — **не міняй**, інакше всі залогінені користувачі будуть викинуті.

---

## 14. 🔑 Google OAuth (Вхід через Google)

1. https://console.cloud.google.com → новий проєкт «Pulito»
2. **APIs & Services → Credentials → Create OAuth client ID** (Web application)
3. **Authorized redirect URIs**: `https://pulito.trade/api/v1/auth/google/callback`

```bash
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
```

---

## 15. 📊 Facebook Pixel + CAPI

Для трекінгу та реклами в FB/Instagram.

1. https://business.facebook.com → **Events Manager → Create Pixel**
2. Скопіюй Pixel ID
3. Налаштування → **Conversions API → Generate access token**

```bash
NEXT_PUBLIC_FB_PIXEL_ID=123456789012345
FACEBOOK_PIXEL_ID=123456789012345
FACEBOOK_CAPI_TOKEN=EAAxxxxxxxxxxx
```

---

## 16. 📷 Instagram Shopping API (опціонально)

Тільки якщо плануєш Instagram Shopping/каталог.

1. Facebook Developers → створи App → додай Instagram Graph API

```bash
INSTAGRAM_APP_ID=...
INSTAGRAM_APP_SECRET=...
INSTAGRAM_ACCESS_TOKEN=...
INSTAGRAM_BUSINESS_ACCOUNT_ID=...
```

---

## 17. 💬 Viber Bot (опціонально, додатковий канал)

1. https://partners.viber.com → створи бота

```bash
VIBER_BOT_TOKEN=твій_токен
```

---

## 18. 🤖 Remove.bg (опціонально, обрізає фон фото товарів)

1. https://www.remove.bg/api → 50 безкоштовних / місяць

```bash
REMOVEBG_API_KEY=...
```

---

## 19. 📋 Axiom (опціонально, агреговані логи)

Якщо хочеш централізовані логи замість `pm2 logs`:

1. https://axiom.co → створи акаунт → новий dataset «pulito»

```bash
AXIOM_TOKEN=xaat-...
AXIOM_DATASET=pulito
```

---

## 20. 🖼️ Налаштування завантаження файлів

```bash
UPLOAD_DIR=/home/pulitotrade/pulito/uploads
MAX_FILE_SIZE=10485760            # 10MB
WATERMARK_TEXT=pulito.trade
WATERMARK_ENABLED=true             # false щоб вимкнути водяний знак на фото
```

Переконайся, що папка існує і доступна:

```bash
ls -la /home/pulitotrade/pulito/uploads
# Якщо нема — створи
mkdir -p /home/pulitotrade/pulito/uploads && chmod 755 /home/pulitotrade/pulito/uploads
```

---

## 21. 🔒 CSP reporting (опціонально)

```bash
SENTRY_CSP_REPORT_URI=https://xxx.ingest.sentry.io/api/xxx/security/?sentry_key=xxx
```

Береться з налаштувань Sentry-проекту → **Settings → Security Headers**.

---

## 22. 🚧 Maintenance mode

Якщо треба тимчасово закрити сайт (оновлення):

```bash
# Через .env
MAINTENANCE_MODE=true

# Або через адмінку: топбар → перемикач «Maintenance» (інтегрований)
```

---

## 23. 🌐 Google Site Verification

Для додавання сайту в Google Search Console.

1. https://search.google.com/search-console → Add property → Verify by **HTML tag**
2. Скопіюй content="..."

```bash
GOOGLE_SITE_VERIFICATION=твій_токен
```

---

## 📊 Підсумок: пріоритет і КРИТИЧНІСТЬ

| Категорія                        | Що додати                                              | Критичність |
| -------------------------------- | ------------------------------------------------------ | ----------- |
| **Магазин не працює без цього**  | `APP_SECRET`, `JWT_SECRET`, `DATABASE_URL`             | 🔴 Critical |
| **Без них немає продажів**       | LiqPay / Monobank / WayForPay (хоч одне), Nova Poshta  | 🔴 Critical |
| **Без них немає сповіщень**      | SMTP (для email), Telegram (для адмін-сповіщень)       | 🟠 High     |
| **Без них немає аналітики**      | GA4, Facebook Pixel, Sentry                            | 🟡 Medium   |
| **Зручність / додаткові канали** | Google OAuth, Viber, Push, Instagram, Remove.bg, Axiom | 🟢 Low      |

---

## ☑️ Чек-лист перевірки після всіх налаштувань

Відкрий по черзі:

| Перевірка      | Де                                                                     | Очікувано                                                        |
| -------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| GA4 події      | DevTools → Network → `collect`                                         | Бачиш запити при перегляді товару, додаванні в кошик, оформленні |
| Telegram       | Створи тест-замовлення                                                 | Прийшло в Telegram повідомлення                                  |
| Nova Poshta    | Чекаут → «Нова Пошта» → введи місто                                    | З'являються підказки                                             |
| Back-in-stock  | Out-of-stock товар → email → у БД виставити quantity > 0 → виклик cron | Прийшов email                                                    |
| Промокод       | Кошик → «Маю промокод» → введи `TEST10` (створи в адмінці)             | Знижка застосувалась                                             |
| Email-кампанія | Admin → Кампанії → «Надіслати зараз»                                   | Прийшов лист                                                     |
| Sentry         | Відкрий `/неіснуюча-сторінка`                                          | Подія в Sentry                                                   |
| Cron           | `tail -f /var/log/syslog \| grep CRON`                                 | Бачиш виконання раз на годину                                    |

---

## ✅ Скрипт перевірки повноти `.env`

```bash
cd /home/pulitotrade/pulito
echo "=== Критичні ==="
for v in APP_SECRET JWT_SECRET DATABASE_URL APP_URL; do
  val=$(grep "^$v=" .env | cut -d= -f2-)
  [ -z "$val" ] && echo "❌ $v (ВІДСУТНІЙ)" || echo "✅ $v"
done
echo ""
echo "=== Платежі ==="
for v in LIQPAY_PUBLIC_KEY MONOBANK_TOKEN WAYFORPAY_MERCHANT_ACCOUNT; do
  val=$(grep "^$v=" .env | cut -d= -f2-)
  [ -z "$val" ] && echo "⚠️  $v (порожній)" || echo "✅ $v"
done
echo ""
echo "=== Доставка ==="
for v in NOVA_POSHTA_API_KEY UKRPOSHTA_BEARER_TOKEN; do
  val=$(grep "^$v=" .env | cut -d= -f2-)
  [ -z "$val" ] && echo "⚠️  $v" || echo "✅ $v"
done
echo ""
echo "=== Сповіщення ==="
for v in SMTP_HOST SMTP_USER SMTP_PASS TELEGRAM_BOT_TOKEN TELEGRAM_MANAGER_CHAT_ID; do
  val=$(grep "^$v=" .env | cut -d= -f2-)
  [ -z "$val" ] && echo "⚠️  $v" || echo "✅ $v"
done
echo ""
echo "=== Аналітика ==="
for v in NEXT_PUBLIC_GA4_ID SENTRY_DSN NEXT_PUBLIC_SENTRY_DSN; do
  val=$(grep "^$v=" .env | cut -d= -f2-)
  [ -z "$val" ] && echo "⚠️  $v" || echo "✅ $v"
done
```

Збережи це як `/home/pulitotrade/check-env.sh`, дай права `chmod +x`, запусти — побачиш одразу що відсутнє.

---

## 🆘 Якщо щось не працює

### Логи додатку

```bash
pm2 logs pulito --lines 200
```

### Логи cron

```bash
sudo grep CRON /var/log/syslog | tail -50
```

### Перевір env-var у запущеному процесі

```bash
pm2 env 0 | grep -E "TELEGRAM|GA4|NOVA"
```

### Перевір що Next.js забрав env

```bash
# Це покаже значення яке бачить запущений процес
node -e "console.log(process.env.NEXT_PUBLIC_GA4_ID)"
```

> Якщо `NEXT_PUBLIC_*` змінні не змінились після rebuild — `npm run build` ще раз (вони bake-яться в bundle).

---

## 🎁 Бонус: швидкий скрипт «все одразу»

Якщо отримав усі ключі — підставити одним махом:

```bash
cd /home/pulitotrade/pulito

# Бекап поточного .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Підставити значення (відредагуй на свої!)
sed -i 's|^NEXT_PUBLIC_GA4_ID=.*|NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX|' .env
sed -i 's|^TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=твій_токен|' .env
sed -i 's|^TELEGRAM_MANAGER_CHAT_ID=.*|TELEGRAM_MANAGER_CHAT_ID=твій_chat_id|' .env
sed -i 's|^NOVA_POSHTA_API_KEY=.*|NOVA_POSHTA_API_KEY=твій_ключ|' .env

# Rebuild + restart
npm run build && pm2 restart pulito

echo "Готово! Перевір на сайті."
```

---

## 📞 Контакт у разі питань

Усі питання щодо налаштування адресуй в робочий чат проєкту. Файл оновлюватиметься в міру додавання нових інтеграцій.

_Останнє оновлення: травень 2026_
