# `/api/v1/cart/[productId]` PUT/DELETE — аналіз

Дата аудиту: 2026-05-27. (cart/validate і cart POST вже покриті в попередніх ітераціях.)

## TOP-2 фіксів

### CT1. `[productId]` PUT/DELETE: відсутній rate-limit

`route.ts:7,27` — обидва handlers без `checkRateLimit`. Авторизований користувач може спамити cart updates 1000/sec — DB write storm + порожні TPC connections.

**Fix:** `checkRateLimit(\`user:\${user.id}\`, RATE_LIMITS.cart)` (30/min).

### CT2. `isNaN(-5)` === false — невалідні productId доходять до сервісу

`route.ts:11,31` — `isNaN(Number('-5'))` повертає `false`, тому `numProductId = -5` потрапляє у `updateCartItem`/`removeFromCart`. Сервіс пробує знайти продукт із id=-5 → Prisma може кинути або порожній результат, але цей шлях коду непередбачуваний.

**Fix:** `Number.isFinite(n) && n > 0 && Number.isInteger(n)`.

---

## Не потребує fix

- **cart/validate** (route.ts) — вже має rate-limit + cap 100 + Integer filter. ✅
- **Zod на updateCartItemSchema** — використовується. ✅ (тільки status 400 → 422 norm — мінорно).
