# Cabinet residual (`/me/recently-viewed`, `/me/saved-addresses`, `/me/notifications/count|stream`) — аналіз

Дата аудиту: 2026-05-27.

## TOP-5 фіксів

### CR1. recently-viewed POST: відсутня Zod-валідація + rate-limit

`route.ts:18-22` — `typeof productId !== 'number'` пропускає `NaN`, від'ємні, дробові, `Number.POSITIVE_INFINITY`. Атакувальник може засмітити таблицю `user_recently_viewed` мільйонами рядків з невалідними productId.

- немає `cart` rate-limit → можна виконати 1000 POST/sec
- немає product-existence check (FK може дати помилку, але атака на bandwidth теж проходить)

**Fix:** Zod schema `productId: z.number().int().positive()` + rate-limit `RATE_LIMITS.cart` + product existence check.

### CR2. recently-viewed GET: limit без guards

`route.ts:8` — `Number(...)` дає `NaN` для нечислових query params; fallback `|| 15` ловить NaN, але не від'ємні (`Number('-50') || 15` → -50) і не дробові. Math.min(-50, 30) = -50 → Prisma `take: -50` → ❌.

**Fix:** `Number.isFinite(n) && n > 0` clamp, `Math.floor`, max 30.

### CR3. notifications/stream SSE: відсутній per-user connection cap

`route.ts` створює `setInterval(5000)` + DB query на кожен SSE connect. Користувач може відкрити N вкладок або N браузерів → N connections → N DB query/sec кожні 5s. На 100 connections — 20 DB query/sec на одного користувача. Атакувальник з кількома акаунтами → DoS на Postgres.

**Fix:** Redis-based counter `sse:notif:${userId}` з TTL=connection-lifetime; max=5 concurrent; при відкритті — `incr`, при close — `decr`. Понад 5 — повертати 429.

### CR4. notifications/count + saved-addresses + recently-viewed GET: відсутній rate-limit

Кожен з 3 GET endpoints викликається з UI (header poll, profile page) — за норми ~раз/30s. Без rate-limit зловмисник з валідним JWT може 1000/sec на DB.

**Fix:** `RATE_LIMITS.api` (60/min) per user.

### CR5. Cache-Control headers відсутні

- `notifications/count` — short-lived data (30s TTL прийнятно).
- `saved-addresses` — список адрес змінюється рідко.
- Обидва без `Cache-Control: private, max-age=...` → кожен запит йде в DB.

**Fix:** додати `Cache-Control: private, max-age=30, must-revalidate` (notifications/count); `private, max-age=60` (saved-addresses).
