# Налаштування Email (SMTP)

Email використовується для:
- Підтвердження реєстрації
- Відновлення пароля
- Сповіщень про замовлення
- Маркетингових розсилок

## Варіант 1 — Gmail (рекомендовано для початку)

### Крок 1 — Увімкнути двофакторну автентифікацію

1. Перейдіть на **https://myaccount.google.com/security**
2. Увімкніть **Двоетапну перевірку** (2-Step Verification)

### Крок 2 — Створити App Password

1. Перейдіть на **https://myaccount.google.com/apppasswords**
2. Оберіть **Ім'я застосунку**: `Clean Shop`
3. Натисніть **Створити**
4. Google покаже 16-символьний пароль (формат: `xxxx xxxx xxxx xxxx`)
5. Скопіюйте його (без пробілів)

> **Важливо:** App Password відображається тільки один раз. Збережіть його.

### Крок 3 — Додати в .env

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxxxxxxxxxxxxxxxx
SMTP_FROM=noreply@yourdomain.com
```

> `SMTP_FROM` може бути будь-яким, але деякі поштові сервіси можуть показувати `SMTP_USER` як реального відправника.

### Обмеження Gmail

- **500 листів на день** для звичайного акаунту
- **2000 листів на день** для Google Workspace
- Достатньо для невеликого магазину

---

## Варіант 2 — SendGrid

Для більших обсягів (до 100 листів/день безкоштовно).

### Крок 1 — Реєстрація

1. Перейдіть на **https://sendgrid.com/**
2. Зареєструйтесь (Free план — 100 листів/день)

### Крок 2 — Створити API Key

1. **Settings** → **API Keys** → **Create API Key**
2. Оберіть **Full Access** або **Restricted Access** (з правами Mail Send)
3. Скопіюйте ключ

### Крок 3 — Додати в .env

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SMTP_FROM=noreply@yourdomain.com
```

> Для SendGrid `SMTP_USER` завжди `apikey`, а `SMTP_PASS` — ваш API Key.

### Крок 4 — Верифікувати домен (рекомендовано)

1. **Settings** → **Sender Authentication** → **Domain Authentication**
2. Додайте DNS-записи, які покаже SendGrid
3. Це покращить доставляємість листів

---

## Варіант 3 — Mailgun

### Крок 1 — Реєстрація

1. Перейдіть на **https://www.mailgun.com/**
2. Зареєструйтесь (Flex план — 100 листів/день безкоштовно перші 3 місяці)

### Крок 2 — Додати домен

1. **Sending** → **Domains** → **Add New Domain**
2. Додайте DNS-записи для верифікації

### Крок 3 — Додати в .env

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@mg.yourdomain.com
SMTP_PASS=your-mailgun-password
SMTP_FROM=noreply@yourdomain.com
```

---

## Перевірка роботи

### Тест з командного рядка

Переконайтеся, що SMTP працює, перезапустивши додаток:

```bash
# Локально
npm run dev

# Production
pm2 reload clean-shop
```

### Тест через сайт

1. Перейдіть на сторінку реєстрації
2. Зареєструйте нового користувача
3. Перевірте пошту — має прийти лист підтвердження

### Тест через адмін-панель

1. Зайдіть в адмін-панель → **Налаштування** → **Email**
2. Надішліть тестовий лист
3. Перевірте вхідні

## Шаблони листів

Шаблони email-повідомлень налаштовуються в адмін-панелі:

1. **Налаштування** → **Email-шаблони**
2. Доступні шаблони:
   - Підтвердження реєстрації
   - Відновлення пароля
   - Підтвердження замовлення
   - Зміна статусу замовлення
   - Нова відправка (трекінг-номер)
3. Кожен шаблон підтримує змінні: `{{name}}`, `{{orderNumber}}`, `{{trackingNumber}}` тощо

## Усунення проблем

### Листи потрапляють у спам

- Налаштуйте **SPF**, **DKIM** та **DMARC** записи для вашого домену
- Використовуйте `SMTP_FROM` з вашим доменом (не gmail.com)
- Верифікуйте домен у SendGrid/Mailgun

### Помилка `Connection timeout`

```bash
# Перевірте доступність SMTP-сервера
telnet smtp.gmail.com 587
```

- Деякі VPS-провайдери блокують порт 25 та 587
- Спробуйте порт **465** (SSL) замість 587
- Зверніться до провайдера для розблокування

### Помилка `535 Authentication failed`

- Перевірте `SMTP_USER` та `SMTP_PASS`
- Для Gmail — переконайтеся, що використовуєте App Password, а не звичайний пароль
- Для Gmail — перевірте, що 2FA увімкнено
