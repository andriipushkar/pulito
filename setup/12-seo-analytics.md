# SEO та аналітика

## Google Search Console

### Крок 1 — Додати сайт

1. Перейдіть на **https://search.google.com/search-console/**
2. Натисніть **Add Property**
3. Оберіть **URL prefix**: `https://yourdomain.com`
4. Натисніть **Continue**

### Крок 2 — Верифікувати домен

Рекомендований спосіб — **HTML-тег**:

1. Скопіюйте мета-тег, який показує Google
2. Він вже може підтягуватись автоматично, якщо Google Analytics підключено

Альтернативно — через **DNS-запис**:

1. Скопіюйте TXT-запис
2. Додайте його в DNS-налаштування домену
3. Дочекайтесь верифікації (до 24 годин)

### Крок 3 — Надіслати Sitemap

1. У Search Console перейдіть у **Sitemaps**
2. Введіть URL: `https://yourdomain.com/sitemap.xml`
3. Натисніть **Submit**

Перевірте, що sitemap генерується:

```bash
curl https://yourdomain.com/sitemap.xml
```

### Крок 4 — Перевірити robots.txt

```bash
curl https://yourdomain.com/robots.txt
```

Очікуваний вміст:

```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api
Sitemap: https://yourdomain.com/sitemap.xml
```

---

## Google Analytics 4 (GA4)

### Крок 1 — Створити ресурс

1. Перейдіть на **https://analytics.google.com/**
2. **Admin** → **Create Property**
3. Введіть назву: `Clean Shop`
4. Оберіть часовий пояс та валюту (Україна, UAH)
5. Натисніть **Create**

### Крок 2 — Створити Data Stream

1. **Admin** → **Data Streams** → **Add Stream** → **Web**
2. Введіть URL: `https://yourdomain.com`
3. Назва: `Clean Shop Web`
4. Натисніть **Create Stream**
5. Скопіюйте **Measurement ID** (формат: `G-XXXXXXXXXX`)

### Крок 3 — Отримати Measurement Protocol API Secret

Для серверного відстеження (server-side tracking):

1. У Data Stream натисніть **Measurement Protocol API secrets**
2. Натисніть **Create**
3. Назва: `Clean Shop Server`
4. Скопіюйте **API Secret**

### Крок 4 — Додати в .env

```env
# Клієнтська аналітика (gtag.js)
NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX

# Серверне відстеження (Measurement Protocol)
GA4_MEASUREMENT_ID=G-XXXXXXXXXX
GA4_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxx
```

### Крок 5 — Перевірити

1. Перезапустіть додаток
2. Відкрийте сайт
3. У GA4 перейдіть у **Realtime** — має з'явитись ваш візит

---

## Facebook Pixel

### Крок 1 — Створити Pixel

1. Перейдіть у **https://business.facebook.com/events_manager**
2. **Data Sources** → **Connect Data Sources** → **Web** → **Facebook Pixel**
3. Назва: `Clean Shop Pixel`
4. Натисніть **Create Pixel**
5. Скопіюйте **Pixel ID** (числовий)

### Крок 2 — Отримати Conversion API Token

Для серверного відстеження (CAPI):

1. У Events Manager → ваш Pixel → **Settings**
2. Прокрутіть до **Conversions API**
3. Натисніть **Generate Access Token**
4. Скопіюйте токен

### Крок 3 — Додати в .env

```env
# Клієнтський Pixel
NEXT_PUBLIC_FB_PIXEL_ID=XXXXXXXXXXXXXXXX

# Серверне відстеження (Conversion API)
FACEBOOK_PIXEL_ID=XXXXXXXXXXXXXXXX
FACEBOOK_CAPI_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Крок 4 — Перевірити

1. Встановіть розширення **Facebook Pixel Helper** для Chrome
2. Відкрийте сайт
3. Розширення має показувати події: `PageView`, `ViewContent`, `AddToCart`, `Purchase`

---

## Google Merchant Center (Google Shopping)

### Крок 1 — Зареєструватись

1. Перейдіть на **https://merchants.google.com/**
2. Зареєструйтесь або увійдіть
3. Додайте інформацію про бізнес

### Крок 2 — Верифікувати сайт

1. **Settings** → **Website** → введіть URL
2. Верифікуйте через Google Search Console (якщо вже підключено — автоматично)

### Крок 3 — Додати фід товарів

1. **Products** → **Feeds** → **Add Feed**
2. Оберіть країну: Україна
3. Мова: Українська
4. Тип: **Scheduled Fetch**
5. URL фіду:

```
https://yourdomain.com/feed/google-shopping
```

6. Розклад: щоденно

### Крок 4 — Перевірити фід

```bash
curl https://yourdomain.com/feed/google-shopping | head -50
```

Фід має бути у форматі XML (Google Shopping / RSS 2.0) з товарами.

### Крок 5 — Діагностика

У Merchant Center → **Diagnostics** перевірте:
- Помилки у товарах
- Відхилені товари
- Попередження

---

## Перевірка всіх інтеграцій

### Чеклист

```bash
# robots.txt
curl -s https://yourdomain.com/robots.txt

# sitemap.xml
curl -s https://yourdomain.com/sitemap.xml | head -20

# Google Shopping фід
curl -s https://yourdomain.com/feed/google-shopping | head -20

# Open Graph мета-теги (перевірка для Facebook)
curl -s https://yourdomain.com | grep "og:"

# Structured Data (JSON-LD)
curl -s https://yourdomain.com | grep "application/ld+json"
```

### Зовнішні інструменти перевірки

| Інструмент | URL | Що перевіряє |
|------------|-----|-------------|
| Google Rich Results Test | https://search.google.com/test/rich-results | Структуровані дані |
| Facebook Sharing Debugger | https://developers.facebook.com/tools/debug/ | Open Graph теги |
| Google PageSpeed Insights | https://pagespeed.web.dev/ | Швидкість та Core Web Vitals |
| Google Mobile-Friendly Test | https://search.google.com/test/mobile-friendly | Мобільна адаптивність |

---

## Cron-задачі для SEO/аналітики

Ці задачі вже налаштовані (див. `02-production-vps.md`):

```bash
# Перерахунок аналітики — щоночі о 3:00
0  3 * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/precompute-analytics

# SEO-перевірка — щоночі о 4:00
0  4 * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/seo-check

# Дайджест аналітики — щоранку о 6:00
0  6 * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/analytics-digest

# Instagram insights — щодня о 8:00
0 8 * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/instagram-insights

# Тижневий звіт — понеділок о 7:00
0 7 * * 1 curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/weekly-report
```
