# Деплой на VPS (Production)

Покрокова інструкція для розгортання Clean Shop на VPS сервері.

## Вимоги до сервера

| Параметр | Мінімум | Рекомендовано |
|----------|---------|---------------|
| ОС | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| RAM | 1 GB | 2 GB |
| SSD | 20 GB | 40 GB |
| CPU | 1 vCPU | 2 vCPU |
| Ціна | ~$5/міс | ~$10/міс |

Провайдери: Hetzner, DigitalOcean, Vultr, Hostinger.

## Крок 1 — Підключитись до сервера

```bash
ssh root@YOUR_SERVER_IP
```

## Крок 2 — Створити користувача

```bash
adduser deploy
usermod -aG sudo deploy
su - deploy
```

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
sudo mkdir -p /var/www/clean-shop
sudo chown deploy:deploy /var/www/clean-shop
git clone <URL-репозиторію> /var/www/clean-shop
cd /var/www/clean-shop
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
DATABASE_URL=postgresql://clean_user:STRONG_PASSWORD_HERE@localhost:6432/clean_shop?schema=public

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
cd /var/www/clean-shop

# Запустити тільки інфраструктуру (без app-контейнера)
docker compose up -d postgres pgbouncer redis typesense

# Перевірити
docker compose ps
```

> **Примітка:** Ми запускаємо app через PM2 (bare-metal), а не через Docker. Це дає більше контролю та швидший перезапуск.

## Крок 10 — Підготувати базу даних

```bash
cd /var/www/clean-shop

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

## Крок 12 — Запустити через PM2

Створіть `ecosystem.config.js`:

```bash
cat > /var/www/clean-shop/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'clean-shop',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/var/www/clean-shop',
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

## Крок 13 — Налаштувати ротацію логів PM2

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
```

## Крок 14 — Налаштувати Nginx

```bash
sudo nano /etc/nginx/sites-available/clean-shop
```

Вставте конфігурацію:

```nginx
upstream clean_shop {
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
        alias /var/www/clean-shop/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Next.js статичні ресурси
    location /_next/static/ {
        proxy_pass http://clean_shop;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # Додаток
    location / {
        proxy_pass http://clean_shop;
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
sudo ln -s /etc/nginx/sites-available/clean-shop /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## Крок 15 — SSL-сертифікат (Let's Encrypt)

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

## Крок 16 — Налаштувати Cron-задачі

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

# === Щомісяця (1-го числа) ===
0 5 1 * * curl -s -X POST -H "Authorization: Bearer YOUR_APP_SECRET" http://localhost:3000/api/v1/cron/instagram-token-refresh
```

## Крок 17 — Налаштувати Firewall

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

> **Важливо:** Не відкривайте порти 5432, 6432, 6380, 8108 — вони повинні бути доступні тільки локально.

## Крок 18 — Перевірити роботу

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
cd /var/www/clean-shop

# Отримати зміни
git pull origin main

# Встановити нові залежності
npm install

# Запустити міграції (якщо є)
npm run db:migrate:prod

# Перезібрати
npm run build

# Перезапустити
pm2 reload clean-shop
```

## Швидкий скрипт деплою

Створіть `/var/www/clean-shop/deploy.sh`:

```bash
#!/bin/bash
set -e

cd /var/www/clean-shop

echo "📥 Pulling latest changes..."
git pull origin main

echo "📦 Installing dependencies..."
npm install

echo "🗄️ Running migrations..."
npm run db:migrate:prod

echo "🔨 Building..."
npm run build

echo "🔄 Reloading PM2..."
pm2 reload clean-shop

echo "✅ Deploy complete!"
```

```bash
chmod +x deploy.sh
./deploy.sh
```
