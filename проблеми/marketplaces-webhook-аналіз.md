# `/api/webhooks/marketplaces/[platform]` — аналіз

Дата аудиту: 2026-05-27. Endpoint single для OLX / Rozetka / Prom / Epicentr.

## TOP-3 фіксів

### MW1. Відсутній rate-limit

`route.ts:291` — POST handler не викликає `checkWebhookRateLimit` чи аналог. Атакувальник (або зламаний marketplace IP) може засипати webhook → import-orders trigger storm → DB-write storm → push-notification spam до admins (`sendPushToAdmins` у handleMessageEvent).

**Fix:** `checkWebhookRateLimit(platform, ip)` на початку handler. Існуючий util приймає string provider.

### MW2. Body unbounded

`route.ts:300` — `await req.text()` без size cap. Marketplace payloads <16KB. Атакувальник з валідним signature (вкрав webhookSecret через config DB compromise) може засипати 100MB payload → пам'ять.

**Fix:** використати `readBoundedBody(req, 256 * 1024)` з webhook-security.

### MW3. Відсутній idempotency / dedup

`route.ts:330-344` — кожен webhook event обробляється навіть якщо повторюється. Marketplaces (особливо OLX) повторюють webhooks при non-2xx. Хоча handler returns 200 завжди (line 354) — це OK для retry уникнення, але якщо marketplace timeout (наприклад push notification бере довго), повторний event = повторний `sendPushToAdmins`, повторний `importOrdersFromMarketplace`.

**Fix:** Redis SETNX dedup за `event.type + extractId(event)`. TTL 24h. Якщо replay — log і skip handler виклик.

---

## Що НЕ потребує fix

- **Signature verification** (lines 24-44) — використовує `crypto.timingSafeEqual` + hex sanity + length-mismatch reject. **Зразково.**
- **Fail-closed на production** (lines 307-312) — webhook secret unset у prod → 503. ✅
- **NaN sanitization у return events** (lines 184-193) — coerces correctly. ✅
- **Handler errors → 200 з error body** (intentional, prevents marketplace retry storm) — trade-off OK.
- **Status mapping для невідомих values** (lines 136-150) — пропускає unmapped без update. ✅
