# Cabinet/auth tail (`subscriptions/[id]`, `verify-email`, `loyalty/streak|challenges|transactions`, `notifications/[id]/read`, `notification-preferences`, `auth/me`) — аналіз

Дата аудиту: 2026-05-27.

## Підсумкові фікси

### SU1. `subscriptions/[id]` GET/PATCH/DELETE

- `isNaN(numId)` пропускає від'ємні → `parsePositiveInt` helper з `Number.isFinite + > 0 + isInteger`.
- Усі три без rate-limit → GET `api`, PATCH/DELETE `subscriptions` per-user.
- PATCH/DELETE без audit log (pause/resume/cancel — важливі user-state events) → `logAudit data_update / data_delete entity=subscription`.

### VE1. `verify-email` POST

- Token validation `typeof === 'string'` без формату → regex `^[a-f0-9]{64}$` (відповідає `randomBytes(32).toString('hex')`).
- Без rate-limit → `RATE_LIMITS.sensitive` per IP.
- Без audit на failed verify → `logAudit user_edit + reason: 'invalid_token'`.

### VE2. `verify-email` PUT (resend)

- Без rate-limit → user (або вкрадена сесія) може mail-bomb їхній inbox і випалити SMTP reputation → `RATE_LIMITS.sensitive` per-user.

### LO1. `loyalty/streak`, `loyalty/challenges`, `loyalty/transactions`

- Усі GET без rate-limit → `RATE_LIMITS.api` per-user.
- `loyalty/transactions` Zod failures → 400 замінено на 422.

### NF1. `notifications/[id]/read` PUT

- `isNaN(numId)` issue → positive-int guard.
- Без rate-limit → `RATE_LIMITS.cart` per-user.

### AM1. `auth/me` PUT

- Без rate-limit (frequent profile edits surface) → `RATE_LIMITS.sensitive` per-user (3/15min — достатньо для legit «змінити імʼя+телефон» flow).
- Zod failures 400 → 422.

### NP1. `notification-preferences` PUT

- Без rate-limit → `RATE_LIMITS.cart` per-user.

### SM1. `/sitemap-products/[chunk]`

- `chunkIndex` без upper bound → атакувальник може `/sitemap-products/9999999` → `skip: 50 млрд` → Postgres expensive OFFSET. Cap `MAX_CHUNK = 10000` (50M products ceiling).
- Без rate-limit → `RATE_LIMITS.publicFeed` per IP (Google bot polls; 60/min generous).

---

## Не потребує fix

- `auth/me` GET — `Cache-Control: no-store` + getUserById вже sanitizes sensitive fields. ✅
- `auth/logout` — Bearer auth, blacklist через redis, audit. ✅
- `log-404` — повноцінно захищений (rate-limit + sanitize headers + skip prefixes/suffixes + max-len). ✅
