# `/api/webhooks/*` (public callback endpoints) — аналіз

Дата аудиту: 2026-05-27. Endpoints у scope: `liqpay`, `monobank`, `wayforpay`, `telegram`, `viber`.

(Окремо від `webhooks-аналіз.md` — той про admin subscription управління, цей про public callback receivers.)

## TOP-8 фіксів

### W1. Non-constant-time signature comparison (LiqPay)

`src/services/payment-providers/liqpay.ts:214` — `if (signature !== expectedSignature)`. Plain string compare у JS early-exits на першому розбіжному байті — атакувальник може через timing side-channel поступово підбирати дійсний підпис, байт за байтом. SHA1 hash =40 hex chars, ~10ms на спробу через webhook → можливо.

**Fix:** `crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))` з length-check.

### W2. Non-constant-time signature comparison (WayForPay)

`src/services/payment-providers/wayforpay.ts:207` — той же шаблон, HMAC-MD5. Той же ризик.

**Fix:** `crypto.timingSafeEqual`.

### W3. Non-constant-time signature comparison (Viber)

`src/services/viber.ts:28` — `hash === signature`. HMAC-SHA256 = 64 hex chars.

**Fix:** `crypto.timingSafeEqual`.

### W4. Non-constant-time secret-token comparison (Telegram)

`src/app/api/webhooks/telegram/route.ts:30` — `if (header !== secretToken)`. Secret-token порівняння — той же risk surface. Telegram retry policy дає атакувальнику необмежено спроб.

**Fix:** `crypto.timingSafeEqual` після length-check.

### W5. Body size unbounded на всіх webhooks

Жоден з 5 endpoint не обмежує розмір body перед `request.json()`/`text()`/`formData()`. Атакувальник може надіслати 100MB body — Next.js parser виділяє пам'ять.

**Fix:** додати `content-length` check перед парсингом. MAX = 64KB для payment, 256KB для telegram/viber.

### W6. Telegram + Viber: catch-all повертає 200 OK на помилки

- `telegram/route.ts:54` — `catch { return NextResponse.json({ ok: true }); }` — будь-яка помилка (включно з JSON parse fail від ворожого payload) повертає 200 OK. Telegram НЕ retry → payload втрачено.
- `viber/route.ts:48` — те саме.

**Fix:** заmiнити на `catch (err) { logger.error(...); return 500 }` (signature errors лишаються окремо 401/403).

### W7. Telegram + Viber: відсутній rate-limit

- Telegram retry до 24h на non-2xx → можна засипати webhook 100k+ updates за хвилину.
- Viber аналогічно.

**Fix:** додати `checkWebhookRateLimit('telegram'|'viber', ip)`.

### W8. Viber: відсутній audit log

`viber/route.ts` не викликає `logWebhook()`. Якщо станеться bot-event flood або payload injection, нічого не залишиться у webhook-log table для forensics.

**Fix:** додати `logWebhook({ source: 'viber', event, statusCode, ... })`.

---

## Що НЕ потребує fix зараз

- **Monobank** — RSA-SHA256 через `crypto.verify()` (native, timing-safe). Timestamp check проти replay. OK.
- **Idempotency через Redis SETNX** — у всіх 5, TTL 24h, graceful Redis-down fallback. OK.
- **LiqPay SHA1 / WayForPay MD5** — per provider spec; algorithm зміна неможлива.
