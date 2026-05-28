# Public `/api/v1/products/*` + `/api/v1/subscribe` — аналіз

Дата аудиту: 2026-05-27. Endpoints у scope: `products/[slug]/reviews`, `products/back-in-stock`, `subscribe`. (Instant-search вже захищений middleware rate-limit-config.)

## TOP-5 фіксів

### PR1. reviews POST: відсутній rate-limit + audit log

`route.ts:29-49` — POST не викликає `checkRateLimit`. `RATE_LIMITS.reviews` (5 per 15min) визначено але не застосовано. Авторизований користувач може спамити 100 reviews/sec, забиваючи DB і chargeable storage.

- немає `logAudit` на створення (security event traceable нема)

**Fix:** `checkRateLimit(\`user:\${user.id}\`, RATE_LIMITS.reviews)`+`logAudit({ actionType: 'data_create', entityType: 'review', ... })`.

### PR2. reviews GET: NaN-unsafe pagination

`route.ts:14-15` — `Number(...)` дає `NaN` для нечислових; `|| 1`/`|| 10` ловить NaN, але не від'ємні. `page=-5` → `(−5−1) * 10 = −60` → Prisma `skip: -60`. `limit=-5` → `Math.min(-5, 50) = -5` → Prisma `take: -5`.

**Fix:** `Number.isFinite(n) && n > 0` + `Math.floor` + cap.

### PR3. back-in-stock: відсутній rate-limit + audit

`route.ts:18-55` — POST без rate-limit. Email можна засабмітити 1000/sec → email-bomb (надсилаючи коли товар з'явиться, чи флуд subscriptions table).

- audit log відсутній.

**Fix:** `checkRateLimit(ip, RATE_LIMITS.api)` (60/min) + `logAudit`.

### PR4. back-in-stock: enumeration через відмінні response codes

`route.ts:32-35`:

- "Товар не знайдено" (404) — продукт неактивний/неіснує
- "Товар уже в наявності" (400) — продукт активний, quantity > 0
- success (200) — продукт активний, OOS

Атакувальник перебирає productId від 1 до N і дізнається які продукти **out-of-stock** (важливо для конкурентів).

**Fix:** uniform 202 Accepted з generic message "Якщо товар доступний для підписки, ви отримаєте сповіщення". Внутрішньо ігнорувати not-found / in-stock, нічого не записуючи.

### PR5. subscribe: email enumeration через POST + GET unsubscribe

- POST `/subscribe` повертає:
  - 409 «вже підписані» → email exists + confirmed
  - 200 «Лист підтвердження надіслано повторно» → email exists + pending
  - 200 «Лист підтвердження надіслано» → email exists + unsubscribed (re-subscribe)
  - 201 → email не існував
- GET `?action=unsubscribe&email=X` → 404 vs 200 → exists check

Конкурент може мати список email-ів і дізнатися хто з них підписаний на newsletter.

**Fix:** uniform 202 «Якщо email валідний — ви отримаєте лист підтвердження» для всіх POST-кейсів. Для GET unsubscribe — uniform 200 success незалежно від результату.

---

## Не fix зараз

- **XSS у review text** — title/comment/pros/cons зберігаються as-is. Frontend React за замовчанням escapes JSX. Якщо є email-template який вставляє ці поля в HTML — то там треба санітайз. Окрема task у cross-cutting (email deliverability + content sanitization).
- **Reviews `images?` поле** — у Zod схемі немає, тому `parsed.data` не містить images → service insertе тільки valid поля. OK.
- **instant-search** — Edge runtime; rate-limit вже у `src/middleware/rate-limit-config.ts:4` через middleware layer (60/min per IP).
