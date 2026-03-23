# Модуль автентифікації

## Огляд

Модуль автентифікації реалізує повний цикл: реєстрація, логін, JWT-токени, верифікація email, скидання пароля, OAuth через Google, прив'язка месенджерів та рольовий доступ.

## Ролі користувачів

| Роль | Опис | Доступ |
|------|------|--------|
| `client` | Роздрібний клієнт | Каталог, кошик, замовлення, особистий кабінет |
| `wholesaler` | Оптовий клієнт | Все що client + оптові ціни, спеціальні правила |
| `manager` | Менеджер магазину | Управління замовленнями, товарами, користувачами |
| `admin` | Адміністратор | Повний доступ до всіх функцій |

## Реєстрація

**Endpoint:** `POST /api/v1/auth/register`

**Вхідні дані (registerSchema):**
```json
{
  "email": "user@example.com",
  "password": "min8chars",
  "fullName": "Iван Iванов",
  "phone": "+380991234567",
  "referralCode": "optional-code"
}
```

**Процес:**
1. Перевірка унікальності email
2. Хешування пароля (bcrypt, 10 rounds)
3. Генерація унікального реферального коду для нового користувача
4. Створення пари токенів (access + refresh)
5. Обробка реферального коду (асинхронно, не блокує реєстрацію)
6. Надсилання листа верифікації (асинхронно)

**Відповідь (201):**
```json
{
  "success": true,
  "data": {
    "user": { "id": 1, "email": "user@example.com", "role": "client" },
    "accessToken": "eyJ..."
  }
}
```
Refresh-токен встановлюється через `Set-Cookie` (httpOnly).

## Логін

**Endpoint:** `POST /api/v1/auth/login`

**Вхідні дані:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Процес:**
1. Пошук користувача за email
2. Перевірка пароля через bcrypt
3. Створення пари токенів з записом IP та device info

## JWT-токени

### Access Token
- Підписується через `jsonwebtoken` з `JWT_SECRET`
- TTL: `JWT_ACCESS_TTL` (за замовчуванням 15 хв)
- Payload (`JwtAccessPayload`): `sub` (userId), `email`, `role`, `type: 'access'`
- Передається в заголовку: `Authorization: Bearer <token>`

### Refresh Token
- TTL: `JWT_REFRESH_TTL` (за замовчуванням 30 днів)
- Payload (`JwtRefreshPayload`): `sub` (userId), `type: 'refresh'`
- Зберігається в httpOnly cookie `refresh_token`
- Хеш токена (SHA-256) зберігається в таблиці `refresh_tokens` з device info та IP

### Оновлення токенів

**Endpoint:** `POST /api/v1/auth/refresh`

Процес rotation:
1. Верифікація refresh-токена з cookie
2. Перевірка хешу в базі (не відкликаний)
3. Відкликання старого refresh-токена
4. Створення нової пари токенів

### Blacklisting

При логауті access-токен потрапляє до Redis blacklist:
- Ключ: `bl:<sha256(token)>`
- TTL: залишковий час життя токена
- Перевіряється middleware при кожному запиті

## Логаут

**Endpoint:** `POST /api/v1/auth/logout`

1. Blacklist access-токена в Redis
2. Revoke refresh-токена в базі даних

## Профіль поточного користувача

**Endpoint:** `GET /api/v1/auth/me`

Повертає дані авторизованого користувача.

## Верифікація email

**Endpoint:** `GET /api/v1/auth/verify-email?token=<token>`

**Процес:**
1. При реєстрації генерується 32-байтний hex-токен
2. Зберігається в Redis: `verify:<token>` -> userId (TTL 24 години)
3. Надсилається email з посиланням
4. При переході -- позначає `isVerified = true`, видаляє токен

## Скидання пароля

### Запит на скидання

**Endpoint:** `POST /api/v1/auth/forgot-password`

```json
{ "email": "user@example.com" }
```

- Завжди повертає успіх (запобігає email enumeration)
- Генерує токен в Redis: `reset:<token>` -> userId (TTL 1 година)
- Надсилає email з посиланням

### Встановлення нового пароля

**Endpoint:** `POST /api/v1/auth/reset-password`

```json
{ "token": "<token>", "password": "newPassword123" }
```

- Верифікує токен з Redis
- Хешує новий пароль
- Відкликає всі refresh-токени користувача (примусовий re-login)

## Google OAuth

**Endpoint:** `POST /api/v1/auth/google`

**Процес (`loginWithGoogle`):**
1. Пошук за `googleId` -- якщо знайдено, логін
2. Пошук за `email` -- якщо знайдено, прив'язка Google ID
3. Інакше -- створення нового акаунту (isVerified = true, генерація реферального коду)
4. Обробка реферального коду для нових користувачів

## Auth Middleware

### withAuth
Обгортка для захищених ендпоінтів:
1. Витягує токен з `Authorization: Bearer <token>`
2. Верифікує через `verifyAccessToken()`
3. Перевіряє blacklist в Redis
4. Додає `user` до контексту хендлера

### withRole
Обгортка для рольового доступу:
```ts
// Тільки admin
export const GET = withRole('admin')(handler);

// Admin або manager
export const GET = withRole('admin', 'manager')(handler);
```

**Відповіді помилок:**
- `401` -- токен не надано, невалідний або відкликаний
- `403` -- недостатньо прав (роль не відповідає)

## Прив'язка месенджерів

### Telegram
- Бот генерує одноразовий токен (Redis, TTL 10 хв)
- Користувач переходить за посиланням на сайт
- Сайт викликає `linkTelegramAccount(userId, token)`
- Записує `telegramChatId` в User

### Viber
- Користувач надсилає `/link email@example.com`
- Генерується 6-значний код (Redis, TTL 10 хв)
- Користувач вводить код у чаті
- Записує `viberUserId` в User

## Файли модуля

- `src/services/auth.ts` -- основна логіка (register, login, refresh, logout, Google OAuth)
- `src/services/auth-errors.ts` -- клас AuthError
- `src/services/token.ts` -- JWT sign/verify, hashing, TTL parsing
- `src/services/verification.ts` -- email verification, password reset
- `src/middleware/auth.ts` -- withAuth, withRole middleware
- `src/types/auth.ts` -- типи JwtAccessPayload, JwtRefreshPayload, AuthUser, TokenPair
- `src/validators/auth.ts` -- Zod-схеми валідації
- `src/utils/cookies.ts` -- серіалізація refresh-токен cookie
- `src/app/api/v1/auth/` -- API routes (register, login, refresh, logout, me, verify-email, forgot-password, reset-password)
