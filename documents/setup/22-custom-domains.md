# 22 — Кастомні домени для tenant-ів

Дозволяє tenant-ам підключати власні домени (наприклад `shop.client.com`) замість субдомену.

## Передумови

- Multi-tenancy увімкнено → [20-multi-tenancy.md](20-multi-tenancy.md)
- Nginx налаштовано → [02-production-vps.md](02-production-vps.md)
- Тарифний план дозволяє кастомний домен (`custom_domain: true`)

## Крок 1 — Процес підключення домену

```
Tenant вводить домен → Система генерує DNS-записи для верифікації
                     → Tenant додає записи в свій DNS
                     → Система верифікує DNS
                     → Генерується SSL-сертифікат
                     → Nginx конфіг оновлюється
                     → Домен активний
```

## Крок 2 — DNS верифікація

Tenant повинен додати два DNS-записи:

```
# CNAME для домену
shop.client.com  CNAME  proxy.pulito.trade

# TXT для верифікації власності
_pulito-verify.shop.client.com  TXT  verify=abc123token
```

API для перевірки DNS:

```bash
# Ініціювати підключення домену
curl -X POST http://localhost:3000/api/v1/tenant/domains \
  -H "Authorization: Bearer TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "domain": "shop.client.com" }'

# Відповідь містить DNS-записи які потрібно створити

# Запустити верифікацію
curl -X POST http://localhost:3000/api/v1/tenant/domains/verify \
  -H "Authorization: Bearer TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "domain": "shop.client.com" }'
```

## Крок 3 — SSL сертифікати

Після успішної DNS верифікації, автоматично генерується SSL через Let's Encrypt:

```bash
# Автоматично виконується системою, але можна вручну:
sudo certbot certonly --nginx -d shop.client.com
```

Для автоматизації потрібен скрипт що викликається після верифікації:

```bash
#!/bin/bash
# /opt/pulito/scripts/add-domain.sh
DOMAIN=$1

# Отримати SSL
sudo certbot certonly --nginx -d "$DOMAIN" --non-interactive --agree-tos

# Створити Nginx конфіг
sudo tee /etc/nginx/sites-available/tenant-$DOMAIN > /dev/null <<NGINX
server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/tenant-$DOMAIN /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Дати право додатку виконувати цей скрипт:

```bash
sudo chmod +x /opt/pulito/scripts/add-domain.sh
# Дозволити pm2 user виконувати certbot і nginx reload
sudo visudo
# Додати: cleanuser ALL=(ALL) NOPASSWD: /usr/bin/certbot, /usr/sbin/nginx, /bin/tee /etc/nginx/sites-available/tenant-*, /bin/ln -sf /etc/nginx/sites-available/tenant-*
```

## Крок 4 — Видалення домену

```bash
curl -X DELETE http://localhost:3000/api/v1/tenant/domains/shop.client.com \
  -H "Authorization: Bearer TENANT_TOKEN"
```

Це видалить Nginx конфіг і деактивує домен. SSL сертифікат залишиться до закінчення терміну.

## Troubleshooting

| Проблема                           | Рішення                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| DNS верифікація не проходить       | DNS propagation може тривати до 48 годин. Перевірте: `dig TXT _pulito-verify.shop.client.com`      |
| SSL сертифікат не генерується      | Перевірте що CNAME вказує на ваш сервер і порт 80 відкритий                                        |
| ERR_SSL_VERSION_OR_CIPHER_MISMATCH | Nginx конфіг не містить SSL — перевірте що certbot створив сертифікат                              |
| Домен показує інший tenant         | Перевірте що домен прив'язаний до правильного `tenantId` в БД                                      |
| Too many certificates              | Let's Encrypt ліміт: 50 сертифікатів на домен/тиждень. Для великих обсягів використовуйте wildcard |
