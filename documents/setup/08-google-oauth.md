# Налаштування Google OAuth (вхід через Google)

Google OAuth дозволяє користувачам входити на сайт через свій Google-акаунт.

## Крок 1 — Створити проєкт в Google Cloud Console

1. Перейдіть на **https://console.cloud.google.com/**
2. Увійдіть у свій Google-акаунт
3. Натисніть на випадаючий список проєктів (зверху) → **New Project**
4. Введіть назву: `Clean Shop`
5. Натисніть **Create**
6. Переконайтеся, що проєкт обраний у верхній панелі

## Крок 2 — Налаштувати OAuth Consent Screen

1. Перейдіть у **APIs & Services** → **OAuth consent screen**
2. Оберіть **External** → **Create**
3. Заповніть:
   - **App name**: Clean Shop
   - **User support email**: ваш email
   - **Developer contact information**: ваш email
4. Натисніть **Save and Continue**
5. **Scopes** — натисніть **Add or Remove Scopes**:
   - Оберіть `email` та `profile`
   - Натисніть **Update** → **Save and Continue**
6. **Test users** — пропустіть (для production не потрібно)
7. **Summary** → **Back to Dashboard**

## Крок 3 — Створити OAuth 2.0 Credentials

1. Перейдіть у **APIs & Services** → **Credentials**
2. Натисніть **+ Create Credentials** → **OAuth client ID**
3. **Application type**: Web application
4. **Name**: Clean Shop Web Client
5. **Authorized JavaScript origins**:

```
http://localhost:3000
https://yourdomain.com
```

6. **Authorized redirect URIs**:

```
http://localhost:3000/api/v1/auth/google/callback
https://yourdomain.com/api/v1/auth/google/callback
```

7. Натисніть **Create**
8. Скопіюйте **Client ID** та **Client Secret**

> Додайте обидва URI (localhost для розробки, yourdomain для production).

## Крок 4 — Додати в .env

```env
GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Перезапустіть додаток:

```bash
# Локально
npm run dev

# Production
pm2 reload clean-shop
```

## Крок 5 — Перевірити роботу

1. Відкрийте сайт → сторінка входу
2. Натисніть кнопку **Увійти через Google**
3. Оберіть Google-акаунт
4. Підтвердіть дозвіл на доступ до email і профілю
5. Вас має перенаправити на сайт як авторизованого користувача

## Крок 6 — Опублікувати додаток (для production)

Поки додаток у статусі "Testing", тільки тестові користувачі можуть входити.

1. Перейдіть у **OAuth consent screen**
2. Натисніть **Publish App**
3. Підтвердіть публікацію

> Для додатків, що запитують тільки `email` та `profile`, верифікація Google не потрібна.

## Усунення проблем

### Помилка `redirect_uri_mismatch`

- Перевірте, що URI в Google Console **точно** збігається з URL додатку
- Зверніть увагу на:
  - `http` vs `https`
  - Наявність або відсутність `/` в кінці
  - Правильний порт (`:3000` для localhost)

### Помилка `access_denied`

- Якщо додаток у статусі "Testing" — додайте свій email у **Test users**
- Або опублікуйте додаток (крок 6)

### Помилка `invalid_client`

- Перевірте `GOOGLE_CLIENT_ID` та `GOOGLE_CLIENT_SECRET` в .env
- Переконайтеся, що креденшали створені для типу "Web application"

### Google кнопка не з'являється

- Перевірте, що обидві змінні заповнені в .env
- Перезапустіть додаток
- Перевірте консоль браузера на помилки
