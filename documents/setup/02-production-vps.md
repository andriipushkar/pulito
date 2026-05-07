# Деплой на VPS (Production)

Покрокова інструкція для розгортання Pulito на VPS сервері.

## Вимоги до сервера

| Параметр | Мінімум          | Рекомендовано    |
| -------- | ---------------- | ---------------- |
| ОС       | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| RAM      | 1 GB             | 2 GB             |
| SSD      | 20 GB            | 40 GB            |
| CPU      | 1 vCPU           | 2 vCPU           |
| Ціна     | ~$5/міс          | ~$10/міс         |

Провайдери: Hetzner, DigitalOcean, Vultr, Hostinger.

## Перед початком — DNS

Перш ніж починати, направте домен на IP сервера:

1. У DNS-панелі вашого домен-реєстратора (або Cloudflare) додайте:

```
yourdomain.com     A    YOUR_SERVER_IP
www.yourdomain.com A    YOUR_SERVER_IP
```

2. Перевірте (може зайняти до 24 годин, зазвичай 5-15 хвилин):

```bash
dig +short yourdomain.com
# Має показати YOUR_SERVER_IP
```

> Якщо використовуєте Cloudflare — спочатку вимкніть проксі (сірий значок), щоб Let's Encrypt міг видати сертифікат. Після налаштування SSL увімкніть назад.

## Крок 1 — Підключитись до сервера

```bash
ssh root@YOUR_SERVER_IP
```

### Налаштувати SSH-ключ (рекомендовано)

На вашому **локальному** комп'ютері:

```bash
# Згенерувати ключ (якщо ще немає)
ssh-keygen -t ed25519 -C "deploy@pulito"

# Скопіювати на сервер
ssh-copy-id root@YOUR_SERVER_IP
```

Після цього вимкніть авторизацію по паролю:

```bash
sudo nano /etc/ssh/sshd_config
# Знайдіть і змініть:
# PasswordAuthentication no
sudo systemctl restart sshd
```

## Крок 2 — Оновити систему та створити користувача

```bash
apt update && apt upgrade -y
adduser deploy
usermod -aG sudo deploy
su - deploy
```

### Swap-файл (для серверів з 1 GB RAM)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Перевірити: `free -h` — має показати 2G swap.

## Крок 3 — Встановити Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v  # v20.x.x
```

## Крок 4 — Встановити Docker

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker deploy
# Перезайдіть у сесію
exit
su - deploy
docker compose version
```

## Крок 5 — Встановити PM2

```bash
sudo npm install -g pm2
```

## Крок 6 — Встановити Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

## Крок 7 — Клонувати проєкт

```bash
sudo mkdir -p /var/www/pulito
sudo chown deploy:deploy /var/www/pulito
git clone <URL-репозиторію> /var/www/pulito
cd /var/www/pulito
npm install
```

## Крок 8 — Налаштувати .env

```bash
cp .env.example .env
nano .env
```

Заповніть для production:

```env
NODE_ENV=production
PORT=3000
APP_URL=https://yourdomain.com

# БД — через Docker (PgBouncer на порту 6432)
DATABASE_URL=postgresql://pulito_user:STRONG_PASSWORD_HERE@localhost:6432/pulito_trade?schema=public

# Redis
REDIS_URL=redis://localhost:6380/0

# Секрети — ОБОВ'ЯЗКОВО згенеруйте нові!
JWT_SECRET=<openssl rand -hex 32>
APP_SECRET=<openssl rand -hex 32>

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com

# Docker Compose потребує ці змінні
POSTGRES_PASSWORD=STRONG_PASSWORD_HERE
TYPESENSE_API_KEY=<openssl rand -hex 32>
```

> **Важливо:** Всі секрети повинні бути унікальними та складними. Генеруйте їх через `openssl rand -hex 32`.

## Крок 9 — Запустити Docker-сервіси

```bash
cd /var/www/pulito

# Запустити тільки інфраструктуру (без app-контейнера)
docker compose up -d postgres pgbouncer redis typesense

# Перевірити
docker compose ps
```

> **Примітка:** Ми запускаємо app через PM2 (bare-metal), а не через Docker. Це дає більше контролю та швидший перезапуск.

## Крок 10 — Підготувати базу даних

```bash
cd /var/www/pulito

# Згенерувати Prisma Client
npm run db:generate

# Запустити міграції
npm run db:migrate:prod

# Наповнити початковими даними (при першому деплої)
npm run db:seed
```

## Крок 11 — Зібрати проєкт

```bash
npm run build
```

## Крок 12 — Підготувати директорію uploads

```bash
mkdir -p /var/www/pulito/uploads
chmod 755 /var/www/pulito/uploads
```

> Якщо використовуєте Cloudflare R2 для файлів — цей крок можна пропустити. Дивіться змінні `R2_*` в [17-env-reference.md](17-env-reference.md).

## Крок 13 — Запустити через PM2

Створіть `ecosystem.config.js`:

```bash
cat > /var/www/pulito/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'pulito',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/var/www/pulito',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
EOF
```

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Виконайте команду, яку PM2 покаже
```

Перевірте:

```bash
pm2 status
curl http://localhost:3000
```

## Крок 14 — Налаштувати ротацію логів PM2

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
```

## Крок 15 — Налаштувати Nginx

```bash
sudo nano /etc/nginx/sites-available/pulito
```

Вставте конфігурацію:

```nginx
upstream pulito_trade {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL буде налаштовано certbot'ом (крок 15)
    # ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Заголовки безпеки
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    client_max_body_size 20M;

    # Статичні файли (завантаження)
    location /uploads/ {
        alias /var/www/pulito/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Next.js статичні ресурси
    location /_next/static/ {
        proxy_pass http://pulito_trade;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # Додаток
    location / {
        proxy_pass http://pulito_trade;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Активуйте конфігурацію:

```bash
sudo ln -s /etc/nginx/sites-available/pulito /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## Крок 16 — SSL-сертифікат (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot автоматично:

- Отримає сертифікат
- Оновить конфігурацію Nginx
- Налаштує автоматичне оновлення

Перевірте автооновлення:

```bash
sudo certbot renew --dry-run
```

## Крок 17 — Налаштувати Cron-задачі

```bash
crontab -e
```

Додайте всі cron-задачі (замініть `YOUR_APP_SECRET` на значення з .env):

```bash
# === Нічне вікно (3:00–5:00) — важкі задачі ===
0  3 * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/db-backup
0  3 * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/precompute-analytics
30 3 * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/reindex-products
0  4 * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/seo-check

# === Ранок (6:00) — щоденні звіти ===
0  6 * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/analytics-digest

# === Щогодини — легкі задачі ===
0  * * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/cleanup-tokens
0  * * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/auto-cancel
0  * * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/notifications

# === Кожні 15 хвилин — критичні за часом ===
*/15 * * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/auto-tracking
*/15 * * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/analytics-alerts

# === Кожні 6 годин ===
0 */6 * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/cleanup-carts
0 */6 * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/price-sync
0 */6 * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/sync-marketplace-prices

# === Щоденно ===
0 8 * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/instagram-insights
0 2 * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/publish-scheduled

# === Щотижня (понеділок) ===
0 7 * * 1 curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/weekly-report

# === Кожні 30 хвилин — email та кампанії ===
*/30 * * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/email-campaigns
*/30 * * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/email-sequences
*/30 * * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/campaigns

# === Щогодини — підписки, маркетплейси, покинуті кошики ===
0 * * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/process-subscriptions
0 * * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/abandoned-carts
0 * * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/sync-marketplace-orders
0 * * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/sync-marketplace-stock

# === Кожні 5 хвилин — health check ===
*/5 * * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/health-check

# === Щоденно — лояльність, бейджі, рекомендації, прогнози ===
0 1 * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/loyalty-daily
0 1 * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/auto-badges
30 3 * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/build-recommendations
0 4 * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/predictions
0 2 * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/publications
0 5 * * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/cleanup-soft-deleted

# === Щомісяця (1-го числа) ===
0 5 1 * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/instagram-token-refresh
```

> **Логування cron:** Щоб бачити результати cron-задач, додайте логування в кінець кожного рядка:
> `>> /var/log/pulito-cron.log 2>&1`
>
> Наприклад: `0 3 * * * curl -s ... http://localhost:3000/api/v1/cron/db-backup >> /var/log/pulito-cron.log 2>&1`

### Початкова індексація Typesense

Після першого деплою потрібно вручну проіндексувати товари:

```bash
curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/reindex-products
```

Перевірте що пошук працює — відкрийте сайт і спробуйте знайти товар.

## Крок 18 — Налаштувати Firewall

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

> **Важливо:** Не відкривайте порти 5432, 6432, 6380, 8108 — вони повинні бути доступні тільки локально.

## Крок 19 — Перевірити роботу

```bash
# PM2 — додаток працює
pm2 status

# Nginx — проксі працює
curl -I https://yourdomain.com

# Docker — інфраструктура працює
docker compose ps

# БД — підключення є
docker compose exec postgres pg_isready

# Redis — працює
docker compose exec redis redis-cli ping
```

Відкрийте `https://yourdomain.com` в браузері — сайт має працювати.

## Оновлення (деплой нової версії)

```bash
cd /var/www/pulito

# Отримати зміни
git pull origin main

# Встановити нові залежності
npm install

# Запустити міграції (якщо є)
npm run db:migrate:prod

# Перезібрати
npm run build

# Перезапустити
pm2 reload pulito
```

## Швидкий скрипт деплою

Створіть `/var/www/pulito/deploy.sh`:

```bash
#!/bin/bash
set -e

cd /var/www/pulito

echo "📥 Pulling latest changes..."
git pull origin main

echo "📦 Installing dependencies..."
npm install

echo "🗄️ Running migrations..."
npm run db:migrate:prod

echo "🔨 Building..."
npm run build

echo "🔄 Reloading PM2..."
pm2 reload pulito

echo "✅ Deploy complete!"
```

```bash
chmod +x deploy.sh
./deploy.sh
```

## Відкат (Rollback)

Якщо після оновлення щось зламалось:

```bash
cd /var/www/pulito

# Подивитись на який коміт відкочуватись
git log --oneline -5

# Відкотити до попереднього коміту
git checkout HEAD~1

# Перезібрати і перезапустити
npm install
npm run build
pm2 reload pulito
```

> Якщо зламалась міграція БД — відновіть з бекапу: [11-backups.md](11-backups.md)

## Що далі

Після базового деплою налаштуйте інтеграції та інфраструктуру (за потреби):

| Пріоритет     | Що зробити                | Гайд                                                   |
| ------------- | ------------------------- | ------------------------------------------------------ |
| Обов'язково   | Платежі (LiqPay/Monobank) | [05-payment-providers.md](05-payment-providers.md)     |
| Обов'язково   | Доставка (Нова Пошта)     | [06-delivery-providers.md](06-delivery-providers.md)   |
| Обов'язково   | Email (SMTP)              | [07-email-smtp.md](07-email-smtp.md)                   |
| Обов'язково   | Бекапи                    | [11-backups.md](11-backups.md)                         |
| Обов'язково   | Моніторинг (Sentry)       | [10-monitoring.md](10-monitoring.md)                   |
| Обов'язково   | JWT RS256                 | [18-jwt-setup.md](18-jwt-setup.md)                     |
| Рекомендовано | Cloudflare CDN            | [cloudflare/setup-guide.md](cloudflare/setup-guide.md) |
| Рекомендовано | Telegram бот              | [03-telegram-bot.md](03-telegram-bot.md)               |
| Рекомендовано | Google OAuth              | [08-google-oauth.md](08-google-oauth.md)               |
| Рекомендовано | SEO + Analytics           | [12-seo-analytics.md](12-seo-analytics.md)             |
| Опціонально   | Push-сповіщення           | [13-push-notifications.md](13-push-notifications.md)   |
| Опціонально   | Маркетплейси              | [15-marketplaces.md](15-marketplaces.md)               |
| Опціонально   | Instagram                 | [09-instagram.md](09-instagram.md)                     |

Повний чекліст: [00-checklist.md](00-checklist.md)
