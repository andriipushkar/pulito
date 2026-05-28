# `/api/v1/auth/*` (public) — аналіз

Дата аудиту: 2026-05-27. Endpoints у scope: `login`, `register`, `refresh`, `forgot-password`, `reset-password`.

## TOP-8 фіксів

### A1. Login: email enumeration через timing-attack

`loginUser()` робить short-circuit при `!user || !user.passwordHash` — повертає 401 **без** bcrypt compare. Атакувальник може відрізнити "користувача нема" від "пароль невірний" за часом відповіді (~80ms різниця).

**Fix:** виконувати dummy `bcrypt.compare` проти фіктивного хешу при user-not-found, щоб час відповіді не різнився.

### A2. Login: дубльований legacy лічильник `LOGIN_ATTEMPTS_PREFIX`

У `loginUser()` живе старий лічильник `login_attempts:${email}` (без IP, без `.toLowerCase()`). Він паралельний з новим `checkLoginRateLimit(ip, email)` з route. Наслідки:

- email-only counter = атакувальник може **DoS-нути конкретного юзера**, заблокувавши його login з будь-якого IP, просто роблячи 5 спроб з різних IP.
- Race: при successful 2FA temp token обидва лічильники в неузгодженому стані.

**Fix:** прибрати legacy лічильник з `loginUser`. Єдиний rate-limit — `checkLoginRateLimit(ip, email)` у route.

### A3. Email не нормалізується у Zod schemas

`loginSchema`, `registerSchema`, forgot-password schema — всі `z.string().email()` без `.trim().toLowerCase()`. Postgres email порівняння залежить від колації; може створитися два акаунти `User@x.com` і `user@x.com`, а login по lowercase знайде один з них недетерміновано. Rate-limit нормалізує до lowercase — Prisma findUnique НЕ.

**Fix:** `.trim().toLowerCase()` для всіх email fields у схемах.

### A4. Refresh endpoint без rate-limit

`/api/v1/auth/refresh` POST не має жодного rate-limit. Можна:

- бомбити з циклу у браузері (broken UI loop)
- атакувати з вкраденим refresh token (хоч detection на refuse-detection працює — але краще обмежити запити)

**Fix:** додати `checkRateLimit(ip, RATE_LIMITS.auth)` (10/min/IP).

### A5. Register: race condition не дає 409

`registerUser` робить `findUnique` → `create`. Між цими двома операціями інший паралельний request може створити юзера з тим же email. Тоді `create` падає з Prisma P2002, що НЕ catched → юзер бачить 500 замість 409.

**Fix:** обернути у try/catch, ловити P2002 і кидати `AuthError('Користувач з таким email вже існує', 409)`.

### A6. Forgot-password: відсутній rate-limit per-email + стары tokens живуть

`requestPasswordReset(email)` ставить новий Redis key `reset:<token>` з token = random 32 bytes. Старі tokens (попередньо створені для того ж юзера) **НЕ видаляються**. Наслідок:

- атакувальник з proxy-pool може запустити 100 reset requests для однієї жертви → 100 emails (spam) + 100 живих tokens у Redis (memory leak).
- per-IP rate-limit `sensitive` (3/15min) обходиться зміною IP.

**Fix:**

- додати per-email lock у Redis: `rl:fp:email:<email>` 3/15min — обмежує спам незалежно від IP.
- зберігати поточний `RESET_PREFIX_BY_USER` ключ для активного reset token юзера; нові запити інвалідовують старі.

### A7. Reset-password: token у Redis plaintext + endpoint без rate-limit + no audit on fail

- Redis ключ — сам token (`reset:<token>`). При компрометації Redis → leak усіх живих reset tokens → миттєвий takeover акаунтів. Best practice: зберігати ключ як `reset:<sha256(token)>`.
- Endpoint POST `/reset-password` не має rate-limit. Брутфорс 64-hex практично неможливий (256 біт), але добра практика — обмежити.
- При invalid/expired token немає audit log — атака не залишає сліду.

**Fix:**

- хешувати token (sha256) перед записом/читанням у Redis.
- додати `RATE_LIMITS.sensitive` per-IP на reset-password.
- audit log на failed reset (userId=null, details: { reason: 'invalid_token' }).

### A8. Register: referralCode/companyName без жорсткої валідації; нема audit на success

- `referralCode` — `z.string().optional()` без max length, без regex. Можна засабмітити 10MB string → DB та logger тиражують його.
- `companyName` має max 200 — OK.
- Успішна реєстрація **не пише audit log**. Створення акаунту — security-relevant подія.
- 2FA-required login та isBlocked rejection теж не пишуть audit (тільки success/fail password).

**Fix:**

- referralCode: `z.string().regex(/^[A-Z0-9]{6,16}$/).optional()`.
- audit log на successful register, isBlocked rejection у login, requiresTwoFactor у login.

---

## Похідні нотатки

- **Login attempts на 2FA verify** — у `verifyTwoFactorLogin` нема жодного rate-limit. Атакувальник з валідним tempToken може брутфорсити 6-значний TOTP (1M комбінацій). Окремий fix потрібен — окрема секція `2fa` далі по roadmap.
- **Google OAuth** — окремий audit у /api/v1/auth/google. Залишаємо на наступну ітерацію.
- **`logout`** — has its own /logout endpoint; перевірити чи приймає stale refresh token gracefully.
