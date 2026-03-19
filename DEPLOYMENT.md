# Clean Shop — Deployment Guide

## Prerequisites

- Node.js >= 20 LTS
- PostgreSQL 16+
- Redis 7+
- PM2 (production process manager)

## Quick Start (Development)

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Install dependencies
npm install

# 3. Copy env
cp .env.example .env
# Edit .env with your values

# 4. Generate Prisma client + run migrations
npm run db:generate
npm run db:migrate

# 5. Seed database (optional)
npm run db:seed

# 6. Start dev server
npm run dev
```

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | `development` / `production` |
| `PORT` | No | `3000` | Application port |
| `APP_URL` | Yes | `http://localhost:3000` | Public URL |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `DATABASE_POOL_MIN` | No | `2` | Min pool connections |
| `DATABASE_POOL_MAX` | No | `10` | Max pool connections |
| `REDIS_URL` | Yes | — | Redis connection string |
| `JWT_SECRET` | Yes | — | JWT signing key (min 32 chars) |
| `JWT_ACCESS_TTL` | No | `15m` | Access token TTL |
| `JWT_REFRESH_TTL` | No | `30d` | Refresh token TTL |
| `SMTP_HOST` | Yes | — | SMTP server host |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_USER` | Yes | — | SMTP username |
| `SMTP_PASS` | Yes | — | SMTP password |
| `SMTP_FROM` | Yes | — | Sender email address |
| `NOVA_POSHTA_API_KEY` | No | — | Nova Poshta API key |
| `UKRPOSHTA_BEARER_TOKEN` | No | — | Ukrposhta StatusTracking bearer token |
| `LIQPAY_PUBLIC_KEY` | No | — | LiqPay Checkout public key |
| `LIQPAY_PRIVATE_KEY` | No | — | LiqPay Checkout private key |
| `MONOBANK_TOKEN` | No | — | Monobank Acquiring X-Token |
| `TELEGRAM_BOT_TOKEN` | No | — | Telegram bot for notifications |
| `TELEGRAM_CHANNEL_ID` | No | — | Channel for order notifications |
| `UPLOAD_DIR` | No | `./uploads` | File uploads directory |
| `MAX_FILE_SIZE` | No | `10485760` | Max upload size (bytes) |
| `APP_SECRET` | Yes | — | App secret for CSRF / signatures |
| `MAINTENANCE_MODE` | No | `false` | Enable maintenance mode |

## Production Deployment

### 1. Build

```bash
npm run build
```

### 2. Database Migrations

```bash
npm run db:migrate:prod
```

### 3. PM2 Setup

Create `ecosystem.config.js`:

```js
module.exports = {
  apps: [
    {
      name: 'clean-shop',
      script: 'node_modules/.bin/next',
      args: 'start',
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
```

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 4. Nginx Reverse Proxy

```nginx
upstream clean_shop {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name shop.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name shop.example.com;

    ssl_certificate     /etc/letsencrypt/live/shop.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shop.example.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    client_max_body_size 20M;

    # Static files (uploads)
    location /uploads/ {
        alias /var/www/clean-shop/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Next.js static assets
    location /_next/static/ {
        proxy_pass http://clean_shop;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # Application
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

### 5. SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d shop.example.com
```

Auto-renewal is configured automatically by certbot.

### 6. Firewall

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Backups

### PostgreSQL

```bash
# Manual backup
pg_dump -U clean_user -h localhost clean_shop > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
psql -U clean_user -h localhost clean_shop < backup_20260101_120000.sql
```

Automated daily backup (crontab):

```bash
0 3 * * * pg_dump -U clean_user -h localhost clean_shop | gzip > /backups/db/clean_shop_$(date +\%Y\%m\%d).sql.gz
0 4 * * * find /backups/db -name "*.sql.gz" -mtime +30 -delete
```

### Scheduled Cron Jobs

All cron endpoints require `Authorization: Bearer $APP_SECRET` header.
Heavy tasks are scheduled between 3:00-5:00 AM to minimize impact on users.

```bash
# === Night window (3:00–5:00) — heavy tasks ===
0  3 * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/db-backup
0  3 * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/precompute-analytics
30 3 * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/reindex-products
0  4 * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/seo-check

# === Early morning (6:00) — daily reports ===
0  6 * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/analytics-digest

# === Every hour — lightweight tasks ===
0  * * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/cleanup-tokens
0  * * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/auto-cancel
0  * * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/notifications

# === Every 15 min — time-sensitive ===
*/15 * * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/auto-tracking
*/15 * * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/analytics-alerts

# === Every 6 hours ===
0 */6 * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/cleanup-carts
0 */6 * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/price-sync
0 */6 * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/sync-marketplace-prices

# === Daily ===
0 8 * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/instagram-insights
0 2 * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/publish-scheduled

# === Weekly ===
0 7 * * 1 curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/weekly-report

# === Monthly ===
0 5 1 * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/instagram-token-refresh
```

### Uploads Directory

```bash
rsync -avz /var/www/clean-shop/uploads/ /backups/uploads/
```

### Redis

Redis is used for caching and session data. It does not need to be backed up — data is ephemeral and rebuilt automatically.

## Monitoring

### PM2 Monitoring

```bash
pm2 monit          # Real-time monitoring
pm2 logs           # View logs
pm2 status         # Process status
```

### Health Check

The application can be checked at `GET /api/v1/health` (if implemented) or simply `GET /`.

### Log Files

- PM2 logs: `~/.pm2/logs/`
- Nginx logs: `/var/log/nginx/`
- PostgreSQL logs: `/var/log/postgresql/`

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U clean_user -h localhost clean_shop -c "SELECT 1"
```

### Redis Connection Issues

```bash
# Check Redis
redis-cli -p 6380 ping

# Check memory usage
redis-cli -p 6380 info memory
```

### Build Failures

```bash
# Clear Next.js cache
rm -rf .next

# Regenerate Prisma client
npm run db:generate

# Rebuild
npm run build
```

### Migration Issues

```bash
# Check migration status
npx prisma migrate status

# Reset database (CAUTION: destroys all data)
npm run db:reset
```
