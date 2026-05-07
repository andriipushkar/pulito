# 20 — Multi-tenancy (SaaS режим)

Кожен tenant (клієнт) отримує ізольований магазин з окремими даними, налаштуваннями та, за бажанням, доменом.

## Архітектура

```
Запит → Middleware (визначає tenant за доменом/subdomain)
      → Tenant context (injected в кожен запит)
      → Ізольовані дані (tenant_id фільтр на всіх таблицях)
```

**Модель ізоляції:** Shared database, shared schema з `tenantId` на кожному записі (row-level isolation).

## Крок 1 — Змінні оточення

```env
# Multi-tenancy
MULTI_TENANCY_ENABLED=true
DEFAULT_TENANT_SLUG=main
TENANT_SUBDOMAIN_BASE=pulito.trade
```

## Крок 2 — Створення першого tenant

```bash
# Через seed або CLI
npx prisma db seed

# Або через адмін API
curl -X POST http://localhost:3000/api/v1/admin/tenants \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Головний магазин",
    "slug": "main",
    "domain": "shop.example.com",
    "settings": {
      "currency": "UAH",
      "language": "uk",
      "timezone": "Europe/Kyiv"
    }
  }'
```

## Крок 3 — Визначення tenant

Middleware визначає tenant у такому порядку:

1. **Custom domain** — `shop.example.com` → шукає в `tenants.domain`
2. **Subdomain** — `tenant1.pulito.trade` → шукає за `slug = tenant1`
3. **Header** — `X-Tenant-ID: uuid` → для API-клієнтів
4. **Default** — використовує `DEFAULT_TENANT_SLUG`

## Крок 4 — Що ізолюється per-tenant

| Дані                  | Ізольовано                | Спільне             |
| --------------------- | ------------------------- | ------------------- |
| Товари, категорії     | Per tenant                | —                   |
| Замовлення, клієнти   | Per tenant                | —                   |
| Налаштування магазину | Per tenant                | —                   |
| Медіа-файли           | Per tenant (окрема папка) | —                   |
| Шаблони email         | —                         | Базові шаблони      |
| Код додатку           | —                         | Один інстанс        |
| БД                    | —                         | Одна БД з tenant_id |

## Крок 5 — Створення нового tenant

```bash
curl -X POST http://localhost:3000/api/v1/admin/tenants \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Магазин Київ",
    "slug": "kyiv",
    "ownerEmail": "owner@kyiv-shop.com",
    "plan": "standard"
  }'
```

Це автоматично:

- Створить запис tenant в БД
- Створить адмін-акаунт для власника
- Застосує налаштування тарифного плану
- Відправить welcome email

## Крок 6 — Nginx для субдоменів

```nginx
server {
    listen 443 ssl;
    server_name *.pulito.trade;

    # SSL (wildcard сертифікат)
    ssl_certificate /etc/letsencrypt/live/pulito.trade/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pulito.trade/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Wildcard SSL сертифікат (через Cloudflare DNS challenge):

```bash
sudo certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d "*.pulito.trade" -d "pulito.trade"
```

## Troubleshooting

| Проблема                        | Рішення                                                      |
| ------------------------------- | ------------------------------------------------------------ |
| Дані одного tenant видно іншому | Перевірте що всі запити фільтруються по `tenantId`           |
| Subdomain не працює             | Перевірте wildcard DNS запис `*.pulito.trade → IP`           |
| Wildcard SSL не працює          | Потрібен DNS challenge, HTTP challenge не підтримує wildcard |
| Повільні запити                 | Додайте index на `tenantId` в усіх таблицях                  |
