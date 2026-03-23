# Cloudflare CDN — Налаштування для Порошок

## Чому Cloudflare?

| Без Cloudflare | З Cloudflare |
|---------------|-------------|
| VPS віддає все: HTML, CSS, JS, зображення | VPS віддає тільки HTML та API |
| ~25 одночасних юзерів | ~200-500 одночасних юзерів |
| Один сервер, одна локація | 300+ CDN точок по всьому світу |
| Немає DDoS захисту | Безкоштовний DDoS захист |
| Платний SSL | Безкоштовний SSL |

**Вартість: $0/міс (Free план)**

---

## Крок 1: Реєстрація

1. Зайти на https://dash.cloudflare.com/sign-up
2. Зареєструватися (email + пароль)

## Крок 2: Додати домен

1. Натиснути "Add a site"
2. Ввести ваш домен: `poroshok.com` (або ваш домен)
3. Обрати **Free план** → Continue
4. Cloudflare просканує DNS записи — підтвердити

## Крок 3: Змінити NS записи

1. Cloudflare покаже 2 nameservers, наприклад:
   ```
   anna.ns.cloudflare.com
   bob.ns.cloudflare.com
   ```
2. Зайти до реєстратора домену (GoDaddy, Namecheap, тощо)
3. Змінити NS записи на Cloudflare
4. Зачекати 5-30 хвилин на пропагацію

## Крок 4: DNS записи

В Cloudflare Dashboard → DNS → Records:

```
Тип    Ім'я           Значення              Proxy
A      poroshok.com   <IP вашого VPS>       ☁️ Proxied
A      www            <IP вашого VPS>       ☁️ Proxied
```

**ВАЖЛИВО:** Переконайтесь що хмаринка ☁️ помаранчева (Proxied), а не сіра (DNS Only).

## Крок 5: SSL/TLS

1. Dashboard → SSL/TLS → Overview
2. Обрати режим: **Full (strict)**
3. Edge Certificates → Always Use HTTPS: **On**
4. Automatic HTTPS Rewrites: **On**
5. Minimum TLS Version: **TLS 1.2**

## Крок 6: Caching

### 6.1 Cache Rules (Dashboard → Caching → Cache Rules)

**Правило 1: Кешувати статику (зображення, CSS, JS)**
```
Якщо: URI Path містить /uploads/ АБО URI Path містить /_next/static/ АБО URI Path містить /images/
Тоді: Cache (Eligible for cache)
  Edge TTL: 1 month
  Browser TTL: 1 year
```

**Правило 2: Не кешувати API**
```
Якщо: URI Path починається з /api/
Тоді: Bypass Cache
```

**Правило 3: Не кешувати адмінку**
```
Якщо: URI Path починається з /admin
Тоді: Bypass Cache
```

### 6.2 Browser Cache TTL (Dashboard → Caching → Configuration)
- Browser Cache TTL: **Respect Existing Headers**
  (наш next.config.ts вже ставить правильні Cache-Control)

## Крок 7: Speed

1. Dashboard → Speed → Optimization
2. **Auto Minify**: CSS ✅, JavaScript ✅, HTML ✅
3. **Brotli**: On ✅
4. **Early Hints**: On ✅
5. **HTTP/2**: On ✅ (автоматично)
6. **HTTP/3 (QUIC)**: On ✅

## Крок 8: Security

1. Dashboard → Security → Settings
2. **Security Level**: Medium
3. **Challenge Passage**: 30 minutes
4. **Browser Integrity Check**: On ✅

### Firewall Rules (Security → WAF → Custom Rules)

**Правило: Блокувати доступ до cron ззовні**
```
Якщо: URI Path починається з /api/v1/cron
І: IP Source Address НЕ ваш VPS IP
Тоді: Block
```

## Крок 9: Оновити .env на сервері

```bash
# Змінити APP_URL на ваш домен через Cloudflare
APP_URL=https://poroshok.com

# Якщо використовуєте R2 для зображень
R2_PUBLIC_URL=https://media.poroshok.com
```

## Крок 10: Перевірка

```bash
# Перевірити що Cloudflare працює
curl -sI https://poroshok.com | grep -E "cf-|server:"
# Очікувано: server: cloudflare, cf-ray: xxx

# Перевірити кешування статики
curl -sI https://poroshok.com/_next/static/chunks/main.js | grep -E "cf-cache|age"
# Очікувано: cf-cache-status: HIT

# Перевірити що API не кешується
curl -sI https://poroshok.com/api/v1/health | grep cf-cache
# Очікувано: cf-cache-status: DYNAMIC
```

---

## Додатково: Cloudflare R2 (для зображень)

Якщо хочете повністю розвантажити VPS від зображень:

1. Dashboard → R2 → Create Bucket → `clean-media`
2. Settings → Public access → Enable (Custom domain: `media.poroshok.com`)
3. API tokens → Create token → R2 Read & Write
4. В .env додати:
   ```
   R2_ACCOUNT_ID=your_account_id
   R2_ACCESS_KEY_ID=your_key
   R2_SECRET_ACCESS_KEY=your_secret
   R2_BUCKET=clean-media
   R2_PUBLIC_URL=https://media.poroshok.com
   ```

---

## Моніторинг

Dashboard → Analytics:
- Requests (всього / кешовані / некешовані)
- Bandwidth Saved (скільки трафіку Cloudflare зекономив)
- Threats Blocked (заблоковані атаки)
- Web Vitals (Core Web Vitals метрики)

---

## Типові помилки

| Проблема | Вирішення |
|----------|-----------|
| 522 Connection timed out | VPS не відповідає. Перевірте `pm2 status` |
| 525 SSL handshake failed | SSL/TLS → поставити **Full**, не Full (strict). Або додати SSL на VPS |
| Redirect loop | SSL/TLS → поставити **Full (strict)**, не Flexible |
| API повертає кешовані дані | Перевірте Cache Rules — API має бути Bypass |
| Зображення не оновлюються | Dashboard → Caching → Purge Cache (Purge Everything) |
