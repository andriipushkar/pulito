# Налаштування Instagram-інтеграції

Інтеграція з Instagram дозволяє:
- Показувати стрічку Instagram на сайті
- Отримувати аналітику (insights)
- Автоматично оновлювати токен доступу

## Крок 1 — Створити Facebook Developer акаунт

1. Перейдіть на **https://developers.facebook.com/**
2. Увійдіть через свій Facebook-акаунт
3. Якщо ще не зареєстровані як розробник — натисніть **Get Started** і пройдіть верифікацію

## Крок 2 — Створити додаток

1. Перейдіть у **My Apps** → **Create App**
2. Оберіть тип **Business**
3. Введіть:
   - **App Name**: Clean Shop Instagram
   - **App Contact Email**: ваш email
4. Натисніть **Create App**

## Крок 3 — Додати Instagram Basic Display API

1. На панелі додатку знайдіть **Add Products**
2. Знайдіть **Instagram Basic Display** → **Set Up**
3. Перейдіть у **Instagram Basic Display** → **Basic Display**
4. Заповніть:
   - **Valid OAuth Redirect URIs**: `https://yourdomain.com/api/v1/auth/instagram/callback`
   - **Deauthorize Callback URL**: `https://yourdomain.com/api/v1/auth/instagram/deauthorize`
   - **Data Deletion Request URL**: `https://yourdomain.com/api/v1/auth/instagram/delete`
5. Збережіть зміни

## Крок 4 — Додати Instagram тестового користувача

1. Перейдіть у **Roles** → **Instagram Testers**
2. Натисніть **Add Instagram Testers**
3. Введіть ваш Instagram username
4. Перейдіть у Instagram → **Settings** → **Apps and Websites** → **Tester Invites** → **Accept**

## Крок 5 — Отримати Access Token

### 5.1 — Отримати короткоживучий токен

Відкрийте у браузері (замініть значення):

```
https://api.instagram.com/oauth/authorize
  ?client_id=YOUR_INSTAGRAM_APP_ID
  &redirect_uri=https://yourdomain.com/api/v1/auth/instagram/callback
  &scope=user_profile,user_media
  &response_type=code
```

Після авторизації ви отримаєте `code` в URL. Обміняйте його на токен:

```bash
curl -X POST "https://api.instagram.com/oauth/access_token" \
  -F "client_id=YOUR_INSTAGRAM_APP_ID" \
  -F "client_secret=YOUR_INSTAGRAM_APP_SECRET" \
  -F "grant_type=authorization_code" \
  -F "redirect_uri=https://yourdomain.com/api/v1/auth/instagram/callback" \
  -F "code=YOUR_CODE"
```

### 5.2 — Обміняти на довгоживучий токен (60 днів)

```bash
curl -X GET "https://graph.instagram.com/access_token\
?grant_type=ig_exchange_token\
&client_secret=YOUR_INSTAGRAM_APP_SECRET\
&access_token=SHORT_LIVED_TOKEN"
```

Відповідь:

```json
{
  "access_token": "LONG_LIVED_TOKEN",
  "token_type": "bearer",
  "expires_in": 5184000
}
```

## Крок 6 — Отримати Business Account ID

```bash
curl "https://graph.instagram.com/me?fields=id,username&access_token=YOUR_LONG_LIVED_TOKEN"
```

Скопіюйте `id` з відповіді.

## Крок 7 — Додати в .env

```env
INSTAGRAM_APP_ID=xxxxxxxxxxxx
INSTAGRAM_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
INSTAGRAM_ACCESS_TOKEN=IGQVJxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
INSTAGRAM_BUSINESS_ACCOUNT_ID=xxxxxxxxxxxx
```

Перезапустіть додаток:

```bash
pm2 reload clean-shop
```

## Крок 8 — Автоматичне оновлення токену

Токен живе 60 днів. Cron-задача автоматично оновлює його щомісяця:

```bash
# Вже налаштовано в crontab (див. 02-production-vps.md)
0 5 1 * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/instagram-token-refresh
```

Задача автоматично:
1. Перевіряє, чи токен скоро закінчиться
2. Оновлює його через Instagram API
3. Зберігає новий токен

## Крок 9 — Перевірити роботу

1. Перейдіть на головну сторінку сайту
2. Прокрутіть до секції Instagram
3. Мають відображатися ваші останні пости
4. Натискання на пост має вести на Instagram

## Усунення проблем

### Помилка `Invalid access token`

- Токен може бути простроченим — перевірте cron-задачу `instagram-token-refresh`
- Згенеруйте новий токен вручну (кроки 5.1 та 5.2)

### Пости не відображаються

```bash
# Перевірте, чи API повертає дані
curl "https://graph.instagram.com/me/media?fields=id,caption,media_url,thumbnail_url,permalink,timestamp&access_token=YOUR_TOKEN"
```

### Помилка `OAuthException`

- Переконайтеся, що Instagram-акаунт прив'язаний до Facebook-сторінки
- Перевірте, що тестовий користувач прийняв запрошення

### Insights не працюють

- Instagram Insights доступні тільки для **Business** або **Creator** акаунтів
- Переключіть акаунт у професійний режим у налаштуваннях Instagram
