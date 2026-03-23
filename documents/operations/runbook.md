# Incident Runbook

## DB не відповідає

1. Перевірити статус з'єднань: `SELECT count(*) FROM pg_stat_activity;`
2. Перевірити PgBouncer: `SHOW POOLS;` через PgBouncer admin console
3. Перевірити місце на диску: `df -h /var/lib/postgresql`
4. Рестартнути PgBouncer: `sudo systemctl restart pgbouncer`
5. Якщо не допомогло — рестарт PostgreSQL: `sudo systemctl restart postgresql`
6. Перевірити логи: `journalctl -u postgresql --since "10 minutes ago"`

## Redis OOM

1. Перевірити використання пам'яті: `redis-cli INFO memory`
2. Видалити прострочені ключі: `redis-cli --scan --pattern "cache:*" | xargs redis-cli DEL`
3. Збільшити maxmemory в `/etc/redis/redis.conf`
4. Встановити eviction policy: `CONFIG SET maxmemory-policy allkeys-lru`
5. Рестарт Redis: `sudo systemctl restart redis`

## Marketplace sync зависла

1. Перевірити логи крону: `docker logs clean-worker --since 30m`
2. Перевірити статус черги: Bull Board dashboard `/admin/queues`
3. Перевірити stuck jobs: `redis-cli LLEN bull:marketplace-sync:active`
4. Ручний ресинк: `curl -X POST /api/v1/cron/marketplace-sync -H "Authorization: Bearer $CRON_SECRET"`
5. Якщо job зависла — видалити з active: через Bull Board "Clean" або API

## Payment webhook не прийшов

1. Перевірити лог вебхуків: таблиця `webhook_log` — `SELECT * FROM webhook_log ORDER BY created_at DESC LIMIT 20;`
2. Перевірити статус у провайдера (LiqPay / Monobank dashboard)
3. Replay вебхук з dashboard провайдера
4. Перевірити що endpoint доступний: `curl -I https://shop.example.com/api/webhooks/payment`
5. Перевірити middleware — чи не блокує rate limiter або CSRF

## High error rate

1. Перевірити Sentry: останні помилки та тренди
2. Перевірити останні деплої: `git log --oneline -5`
3. Перевірити health endpoint: `curl /api/v1/health`
4. Перевірити метрики: `/api/v1/metrics`
5. Rollback якщо потрібно:
   ```bash
   # Визначити попередній стабільний коміт
   git log --oneline -10
   # Деплой попередньої версії
   git revert HEAD && git push
   ```

## SSL expired

1. Перевірити статус сертифіката: `echo | openssl s_client -connect shop.example.com:443 2>/dev/null | openssl x509 -noout -dates`
2. Оновити вручну (Let's Encrypt): `sudo certbot renew --force-renewal`
3. Перевірити auto-renewal: `sudo systemctl status certbot.timer`
4. Увімкнути auto-renewal якщо вимкнено:
   ```bash
   sudo systemctl enable certbot.timer
   sudo systemctl start certbot.timer
   ```
5. Перезавантажити nginx: `sudo systemctl reload nginx`
