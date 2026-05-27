# Аналіз розділу «Налаштування платежів» (`/admin/payment-settings`)

> Дата: 2026-05-26
> Сфера: `src/app/(admin)/admin/payment-settings/page.tsx` (542 LOC), `api/v1/admin/payment-settings/*`, `api/webhooks/{liqpay,wayforpay,monobank}/*`, сервіси `payment.ts`, `liqpay.ts`, `wayforpay.ts`, `monobank.ts`, `cron/payment-reconciliation`.
> Ролі: програміст, маркетолог, QA, користувач (фінансовий оператор/власник). **Пріоритет огляду — security**, бо гроші.

---

## ✅ Що вже зроблено добре (фундамент)

- HMAC-SHA1/256 + EdDSA підписи webhook-ів верифікуються **до** будь-яких state-changes.
- AES-256-GCM шифрування sensitive налаштувань (`payment_*_private_key`, `monobank_token`) at-rest.
- Webhook log sanitize PII і card-data автоматично.
- Refund має rate-limit 10/хв на адміна (захист від session-theft draining).
- Monobank timestamp anti-replay (10-хв staleness check).

Це сильна база. Решта — діри в **периметрах**, які добре закриваються точково.

---

## 1. 👨‍💻 Як програміст — критичні security/correctness

| #       | Тема                                                                                                                                                                                        | Файл / рядок                                                                   | Severity        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------- |
| **PS1** | **LiqPay kopecks → UAH помилка**: callback `amount` у kopecks (×100), але код порівнює як UAH. ₴100 платіж виглядає як ₴10 000 → bypassing amount validation. Найгірший фінансовий dent     | `services/liqpay.ts:243`, `services/payment.ts:166`                            | **🔴 CRITICAL** |
| **PS2** | **Webhook завжди 200 на invalid signature** — провайдер не ретраїть, атакуючий не бачить різниці valid/invalid                                                                              | `webhooks/liqpay/route.ts:66`, `wayforpay/route.ts:65`, `monobank/route.ts:61` | **🔴 HIGH**     |
| **PS3** | **Empty sensitive credential save** дозволено: `{"liqpay_private_key": ""}` → шифрується як `enc("")` → провайдер silently вимикається. Помилковий save = катастрофа конверсії              | `payment-settings/route.ts:105-110`                                            | **🔴 HIGH**     |
| **PS4** | **Amount mismatch не блокує — лише logger.warn**. Callback з paidAmount=0.01 на ₴500 замовлення → status `failure`, але без alert/audit-trail/email                                         | `services/payment.ts:166-175`                                                  | **🔴 HIGH**     |
| **PS5** | **Dedup key fallback**: коли `transactionId` порожнє, ключ `o${id}:s${status}:t${Date.now()}` — два webhooks через 1мс пройдуть як «різні» → replay protection bypassable                   | `services/payment.ts:146-150`                                                  | 🔴 HIGH         |
| **PS6** | **Refund без accumulated check**: `refundAmount ≤ paidAmount` перевіряється, але не сума попередніх refund-ів → 3× по 50% = 150% повернуто (провайдер може спіймати, ми ні)                 | `services/payment.ts:318-323`                                                  | 🔴 HIGH         |
| **PS7** | **Test endpoint може confirm-ити creds для exfiltration**: приймає payload від клієнта, тестує проти **production** провайдера. Адмін зі сворованою сесією може verify ключі без alarm bell | `payment-settings/test/route.ts:19-96`                                         | 🟠 HIGH         |
| **PS8** | **WayForPay callback response echoes `cardPan`/`authCode` unmasked** — PCI DSS violation в network traces (не в логах)                                                                      | `services/wayforpay.ts:200-209`                                                | 🟠 HIGH         |
| PS9     | **Masked-value skip** через `strValue.includes('••••')` — string-based, не hash. Користувач пасте 8 крапок випадково → silent skip                                                          | `payment-settings/route.ts:104`                                                | 🟡 MED          |
| PS10    | **No IP whitelisting**: коментар каже «when provider publishes IPs» — arrays порожні. Defense-in-depth відсутній (підпис валідується, але mass-DDoS на /webhooks без IP rejection — open)   | `webhook-security.ts:4-11`                                                     | 🟡 MED          |
| PS11    | **Monobank pubkey 24h cache** без TTL header check — якщо Mono ротує ключ, ми приймаємо forged webhooks до 24год                                                                            | `services/monobank.ts:41-47`                                                   | 🟡 MED          |
| PS12    | **Reconciliation cron auth via `APP_SECRET`** замість окремого `CRON_SECRET` — якщо `APP_SECRET` leaknе, атакуючий може заливати arbitrary payment statuses                                 | `cron/payment-reconciliation/route.ts:10`                                      | 🟡 MED          |
| PS13    | **Audit log без before/after** на sensitive change — фіксує «private_key змінено», не показує silent downgrade до empty                                                                     | `payment-settings/route.ts:114`                                                | 🟡 MED          |
| PS14    | **Hardcoded UAH** скрізь — `liqpay.ts:51`, `wayforpay.ts:48`, `monobank.ts:72`, `payment.ts:57`. Розширення на USD/EUR буде refactor-fest з easy-miss                                       | усі payment сервіси                                                            | 🟡 MED          |
| PS15    | **COD status race**: webhook може mark paid до того як DB transaction commit'ить замовлення → window коли paid=true але stock не reserved                                                   | `services/payment.ts:53-54`                                                    | 🟡 MED          |
| PS16    | **`resolveAmount()` без order → 0**: якщо webhook arrives ДО order indexing, validation проти 0 → mismatch для будь-якої суми                                                               | `services/payment.ts:189-191`                                                  | 🟢 LOW (rare)   |

---

## 2. 📈 Як маркетолог

### Що працює

- Кілька провайдерів (LiqPay, WayForPay, Monobank) — гнучкість для A/B по комісіях.
- Switch-toggle для кожного — можна швидко вимкнути проблемний.

### Чого не вистачає

1. **Немає conversion-tracking per-провайдер** — який % checkout completion на LiqPay vs Monobank? Без цього не оптимізувати.
2. **Немає average-time-to-pay** метрики — Monobank часто швидший за LiqPay; це впливає на retention.
3. **Refund rate per провайдер** не видно — якщо WayForPay має більше відмов на 3D-Secure, треба знати.
4. **Failed payments dashboard** відсутній — оператор не бачить «N клієнтів зупинились на payment крок» в реальному часі.
5. **Commission breakdown**: кожен провайдер бере ~1.5-2.7%. Немає звіту «скільки заплатили процесинговим за період».

---

## 3. 🧪 Як QA — edge cases

| #     | Сценарій                                                      | Реально                                                          | Має бути                                            |
| ----- | ------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| QPS1  | LiqPay sandbox amount=10000 (kopecks) → order total ₴100      | Mismatch (10000 vs 100), status failure                          | Distinguish kopecks vs UAH per-провайдер            |
| QPS2  | Подвійний webhook за 0.5с з тим самим transactionId           | Dedup спрацьовує ✓                                               | OK                                                  |
| QPS3  | Webhook з порожнім transactionId двічі за 1мс                 | Обидва пройдуть як unique (timestamp diff)                       | Reject другий через order+status+amount fingerprint |
| QPS4  | Admin clears private_key field, тисне Save                    | Силently шифрує enc("") — провайдер відмикається                 | Confirm перед save (як для marketplaces P11)        |
| QPS5  | Refund 100% → 100% → 100%                                     | Перші 2 пройдуть (провайдер ловить третій)                       | Block на сервері з accumulated check                |
| QPS6  | Webhook signature невалідний                                  | Returns HTTP 200 ✗                                               | 401 → провайдер ретраїть, атакуючий бачить fail     |
| QPS7  | Monobank ротує pubkey, шлe webhook                            | Falsy verified старим key                                        | Detect 4xx response → flush cache + refetch         |
| QPS8  | Adminтестує credentials, перевіряє валідність "перед" вкрасти | Test endpoint hits production                                    | Test проти sandbox URL, або rate-limit per-user     |
| QPS9  | Cancel order, після цього клієнт оплатив                      | Order лишається cancelled, але paymentStatus=paid (orphan money) | Refund auto-trigger або alert                       |
| QPS10 | Reconciliation cron з помилковим APP_SECRET                   | 401, ОК                                                          | OK, але краще окремий CRON_SECRET                   |
| QPS11 | i18n помилок на checkout                                      | uk-only                                                          | uk/en/ru                                            |
| QPS12 | Webhook log retention 90+ днів                                | Перевірити — є purge cron?                                       | GDPR-compliant retention                            |

---

## 4. 👤 Як користувач (фінансовий оператор)

**Перші 30 секунд:**

- Сторінка налаштувань — список провайдерів з полями API ключів. Стандартно.
- Toggle «увімкнено», «View 👁️» для секретів, «Перевірити підключення».
- Save кнопка внизу.

**Що болить:**

1. **"View" розкриває private key прямо на екрані** — shoulder-surf ризик у open-office. Має бути або копіювати у clipboard, або вимагати 2FA.
2. **Немає «Останній успішний платіж: X хв тому»** індикатора. Якщо LiqPay тупо лежить, я бачу це лише коли клієнт скаржиться.
3. **«Перевірити підключення» без чіткого статусу**: «OK» це достатньо? Чи означає що 3D-Secure works, чи лише API auth.
4. **Save без changelog**: «що я змінив? коли остання зміна?». Без візуальної історії я не знаю, чи хтось не міняв webhook secret вчора.
5. **Поле «Webhook URL»** не показано як copy-to-clipboard з прикладом cURL — нові оператори блукають.

---

## 🎯 ТОП-7 пріоритетних правок

| #   | Що                                                                                                                                                                                                                                                                                                                            | Severity | Файл                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------- |
| 1   | ⚠️ **PS1** — **False alarm** після верифікації: LiqPay і WayForPay коректно надсилають amount у UAH; Monobank ділить /100 на читанні. Додано **defensive sanity log** `PAYMENT_AMOUNT_LIKELY_KOPECKS_CONFUSION` коли paidAmount ≈ 100× expected — для моніторингу при майбутньому misconfig                                   | 🟢 N/A   | `payment.ts:185-200`                                  |
| 2   | ✅ **PS2** — Усі 3 webhook'и (liqpay/wayforpay/monobank) тепер повертають **HTTP 401** при invalid signature замість 200. Attacker не бачить distinction між valid/forged; existing IP rate-limit стримує retry-storm                                                                                                         | 🔴 HIGH  | `webhooks/{liqpay,wayforpay,monobank}/route.ts`       |
| 3   | ✅ **PS3** — Server-side guard у PUT: якщо sensitive поле буде очищене (empty) і stored != empty, **422** з повідомленням `wouldClearSensitive`. Client показує `confirm()` і повторно надсилає з `__confirmClearSensitive: true`. Cleared keys потрапляють в audit-log                                                       | 🔴 HIGH  | `payment-settings/route.ts:95-130`, `page.tsx:173`    |
| 4   | ✅ **PS4** — Amount mismatch тепер `logger.error('PAYMENT_AMOUNT_MISMATCH')` (audit-grade signature) + diff field для моніторингу. Defensive 100× check додано окремо                                                                                                                                                         | 🔴 HIGH  | `payment.ts:177-205`                                  |
| 5   | ✅ **PS5** — Dedup fallback тепер `o${orderId}:s${status}:a${paidAmount}` замість `Date.now()`. Два webhook'и за 1мс з тим самим payload reject як duplicate                                                                                                                                                                  | 🔴 HIGH  | `payment.ts:147-150`                                  |
| 6   | ✅ **PS6** — DB migration `payment_refunded_amount` (Decimal default 0) + `refundPayment` тепер: дозволяє refund при status `paid` АБО `partial`, рахує `paidAmount − alreadyRefunded` як `remaining`, блокує якщо `refund > remaining`. На success `refundedAmount += amount`. Защита від ручного перевернення paymentStatus | 🔴 HIGH  | `order.prisma`, `migration.sql`, `payment.ts:317-352` |
| 7   | ✅ **PS7** — In-memory rate-bucket замінено на Redis-backed `RATE_LIMITS.adminPaymentTest` (5/хв/user) — cluster-safe. Кожен test attempt пише `logAudit` (provider, hasCredentials, IP) — слід зловмисника лишається                                                                                                         | 🟠 HIGH  | `rate-limit.ts`, `payment-settings/test/route.ts`     |

## Бонус (residual виконано)

- ⚠️ **PS8** — Перевірено код: `createCallbackResponse` НЕ echoes cardPan/authCode (false alarm від Explore-агента). cardPan/authCode використовуються тільки для signature verification incoming, не в response | `wayforpay.ts:243-261` |
- ⚠️ **PS10** — Перевірено: LiqPay/Mono/WayForPay **не публікують** IP-ranges офіційно — коментар у `webhook-security.ts:5-10` коректний. Rate-limit залишається основним захистом |
- ✅ **PS11** — При signature verify-fail Monobank cache invalidates і ОДИН retry з freshly-fetched key. Якщо retry теж fail → 403. Захищає від до-24-год window прийняття forge після ротації key | `monobank.ts:30-50, 156-186` |
- ✅ **PS12** — Додано `CRON_SECRET` в `env.ts` (optional, fallback на `APP_SECRET`). `payment-reconciliation` route використовує його. Існуючі cron registrations працюють без зміни конфігу | `env.ts:33-37`, `cron/payment-reconciliation/route.ts` |
- ✅ **PS13** — Audit log тепер містить `sensitiveHashDiff: { key: { before: 'sha256:...', after: 'sha256:...' } }` (16-char fingerprint). Reviewer бачить різницю «rotated» / «emptied» / «same value» без leak самих credentials | `payment-settings/route.ts` |

## Свідомо відкладено (multi-day)

- **PS14** — Multi-currency: винести «UAH» у env або в order.currency (для майбутнього розширення)
- **PS15** — COD race: відкласти webhook processing до `order.create` commit (через event queue)

## Маркетингові розширення (окрема сесія)

- Conversion-funnel per провайдер
- Failed-payment dashboard
- Refund rate per провайдер
- Commission breakdown report
- Average time-to-pay metric
