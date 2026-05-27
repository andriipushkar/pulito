# Аналіз розділу «Налаштування доставки» (`/admin/delivery-settings`)

> Дата: 2026-05-26
> Сфера: `src/app/(admin)/admin/delivery-settings/page.tsx` (339 LOC), `api/v1/admin/delivery-settings/*`, public delivery endpoints (`cities`, `streets`, `warehouses`, `estimate`, `tracking`, `ukrposhta-cities`), сервіси `nova-poshta.ts`, `ukrposhta.ts`, per-order TTN endpoint, pallet-delivery.
> Ролі: програміст, маркетолог, QA, користувач (логіст/оператор).

---

## ✅ Сильні сторони (фундамент)

- AES-256-GCM шифрування sensitive налаштувань (NP API key) — нагадує payment-settings pattern.
- Маскування у GET (`first4••••last4`).
- 2FA-обгортка на admin endpoints через `withRole2fa`.
- Спільний bulk-TTN endpoint вже має `callWithBackoff` (fix із попередньої сесії orders).

---

## 1. 👨‍💻 Як програміст — критичні security/correctness

| #       | Тема                                                                                                                                                                                         | Файл / рядок                                                  | Severity                  |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------- |
| **DS1** | **Public `/api/v1/delivery/tracking`** без auth і без ownership-check. Будь-який запит з валідним TTN → повний статус, recipient name/phone/address від NP/Ukrposhta. TTN-формати enumerable | `delivery/tracking/route.ts:1-31`                             | 🔴 HIGH (PII leak)        |
| **DS2** | **Per-order TTN race**: `if (order.trackingNumber)` без unique-constraint → два паралельні створюють 2 TTN, плата за обидва                                                                  | `orders/[id]/ttn/route.ts:96-98`                              | 🔴 HIGH (фінансовий)      |
| **DS3** | **Empty NP API key save** без `__confirmClearSensitive` guard (як зробили для payment-settings PS3). Випадковий save з порожнім ключем тихо ламає чекаут                                     | `delivery-settings/route.ts:84`                               | 🔴 HIGH                   |
| **DS4** | **Test endpoint приймає client-passed creds** замість stored. Stolen admin session → verify arbitrary keys before exfil                                                                      | `delivery-settings/test/route.ts:23-50`                       | 🔴 HIGH                   |
| **DS5** | **Weight validator min 0.1** (kg чи грами?) — NP вимагає ≥0.5 кг. Якщо UI шле грами/кг неузгоджено → silent reject або incorrect billing                                                     | `validators/delivery.ts:7`, `nova-poshta.ts:186`              | 🟠 MED-HIGH               |
| **DS6** | **Public delivery endpoints без specific rate-limit**: cities/streets/warehouses/estimate fall back на generic 100/min → DoS via autocomplete spam                                           | `middleware/rate-limit-config.ts`                             | 🟠 HIGH                   |
| **DS7** | **GET delivery-settings** дозволяє manager-role: leaky 8-char masked credential (first4+last4)                                                                                               | `delivery-settings/route.ts:51-52`                            | 🟠 MED                    |
| **DS8** | **Settings cache не atomic** з upsert: між `upsert` і `invalidateSettingsCache` checkout читає старий empty key → платіж/чекаут failed                                                       | `delivery-settings/route.ts:112`                              | 🟠 MED                    |
| DS9     | **NP city/warehouse Ref staleness**: Ref UUID кешуються в order без version-check. NP оновлює directory → старі ref → «warehouse not found» на чекауті                                       | `nova-poshta.ts:55-86`                                        | 🟡 MED                    |
| DS10    | **Encryption salt hardcoded** (`'salt'` literal). Якщо APP_SECRET leak → pre-computable keys                                                                                                 | `lib/encryption.ts:4`                                         | 🟡 MED (defense-in-depth) |
| DS11    | **Estimate cost float drift**: cache-key `${weight}:${total}` rounds inconsistently                                                                                                          | `delivery/estimate/route.ts:63`                               | 🟢 LOW                    |
| DS12    | **Test endpoint без audit-log** (як зробили для payment-test) — stolen session не лишає сліду                                                                                                | `delivery-settings/test/route.ts`                             | 🟢 LOW                    |
| DS13    | **Pallet-delivery дублюючий config**: `/admin/pallet-delivery` має окремі налаштування — користувач не розуміє, чи це share API key з NP                                                     | `delivery-settings/page.tsx:305`, `settings/pallet-delivery/` | 🟢 LOW UX                 |

---

## 2. 📈 Як маркетолог

**Сильні сторони:**

- NP + Ukrposhta — основні UA-провайдери покриті.
- Pallet delivery як окремий канал — гнучкість для оптових клієнтів.

**Чого бракує:**

1. **Немає conversion-per-delivery-method**: NP self-pickup vs courier vs Ukrposhta — який дає вище AOV?
2. **Без NP-account balance visibility**: оператор не знає, скільки лишилось TTN-quota (рідко, але важливо для великих shop-ів).
3. **Average delivery cost per region/category** не показано — для маркетингових free-shipping кампаній.
4. **Failed deliveries metric** відсутня — % замовлень, що повертаються через «не вдалось доставити».
5. **Estimate cache hit-rate** не видно — якщо клієнти змінюють адресу часто, потрібно зрозуміти ефективність кешу.

---

## 3. 🧪 Як QA — edge cases

| #     | Сценарій                                                                 | Реально                                                      | Має бути                                                              |
| ----- | ------------------------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------- |
| QDS1  | Запит `/api/v1/delivery/tracking?trackingNumber=12345678901234` без auth | Повертає full статус включно з recipient name/phone          | 401 або owner-check                                                   |
| QDS2  | Два clicks на «Створити TTN» в детальному order page                     | 2 NP API calls = 2 TTN-и створено, обидва білуються          | useRef-guard + DB unique-constraint                                   |
| QDS3  | Очистити NP API key, тиснути Save                                        | Saved as `enc("")` — checkout тихо breaks                    | Confirm перед save                                                    |
| QDS4  | Admin тестує **інший** NP API key (не той, що в DB)                      | Endpoint hits prod NP з client-supplied key → verifies valid | Load from DB, only allow override якщо credential differs from masked |
| QDS5  | POST `/admin/orders/{id}/ttn` з weight=0.001                             | NP силently reject або accept invalid                        | Validator clamp ≥0.5 кг                                               |
| QDS6  | 1000 запитів `/api/v1/delivery/cities?query=ki` за хвилину               | Generic limit 100/min — більшість пройде                     | Specific limit 30/min                                                 |
| QDS7  | NP оновив warehouse Ref, на checkout вибрано старий                      | "Warehouse not found" generic error                          | Auto-refresh + fallback prompt                                        |
| QDS8  | Two admins зберігають delivery settings одночасно                        | Last-write-wins без conflict                                 | Optimistic-lock (як на products)                                      |
| QDS9  | Manager-role читає settings                                              | Бачить `1234••••5678` — leaky                                | Admin-only GET для sensitive                                          |
| QDS10 | Cache stale між save+invalidate (~10ms)                                  | Чекаут може узяти старий key                                 | atomic upsert + invalidate в transaction                              |

---

## 4. 👤 Як користувач (логіст/оператор)

**Перші 30 секунд:**

- Сторінка з полями NP API ключа + tabs/section для Ukrposhta.
- «Перевірити підключення» кнопка.
- Окрема сторінка для pallet-delivery — заплутує.

**Що болить:**

1. **Test без status detail**: «OK» — credential auth ОК, але чи 3D-Secure / sender-address коректні?
2. **Empty save без warning** — катастрофа конверсії.
3. **No NP balance visibility**: «Залишилось N TTN у місяці» — обов'язково бачити.
4. **Pallet delivery — окрема сторінка** з власним config — duplication-болем без хінту.
5. **Tracking зовнішній — без branding**: клієнт переходить на NP-сайт, не наш.

---

## 🎯 ТОП-7 пріоритетних правок

| #   | Що                                                                                                                                                                                                                                    | Severity | Файл                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------- |
| 1   | ✅ **DS1** — Public tracking тепер вимагає **пару** `(orderNumber, trackingNumber)`. Сама лише TTN ⟶ 400. Невідповідність пари ⟶ 404. Додано IP rate-limit `RATE_LIMITS.search` (30/хв). PII-leak через TTN-enum закрито              | 🔴 HIGH  | `delivery/tracking/route.ts`             |
| 2   | ✅ **DS2** — Per-order TTN використовує атомарний `updateMany where trackingNumber IS NULL` з sentinel-значенням `PENDING_<id>_<ts>`. Другий паралельний запит бачить sentinel і повертає 409. При failure NP API — sentinel rollback | 🔴 HIGH  | `orders/[id]/ttn/route.ts:96-130`        |
| 3   | ✅ **DS3** — Server-side guard 422 на empty sensitive (NP key, Ukrposhta token) + `__confirmClearSensitive` flag + client confirm dialog. Mirror `payment-settings` PS3                                                               | 🔴 HIGH  | `delivery-settings/route.ts`, `page.tsx` |
| 4   | ✅ **DS4** — Test endpoint load credentials from DB (`loadStoredKey` helper з AES-decrypt). Client config — лише override для "pasted new key" flow. Redis rate-limit + audit-log per attempt                                         | 🔴 HIGH  | `delivery-settings/test/route.ts`        |
| 5   | ✅ **DS5** — `deliveryEstimateSchema.weight` тепер `min(0.5)` з коментарем «KILOGRAMS, NP smallest billed parcel». Уніфіковано з bulk-TTN                                                                                             | 🟠 MED   | `validators/delivery.ts`                 |
| 6   | ✅ **DS6** — Новий `RATE_LIMITS.publicDelivery` (30/хв per IP) застосовано до **5 endpoints**: cities, streets, warehouses, estimate, ukrposhta-cities. Захист від autocomplete-spam DoS проти NP upstream                            | 🟠 HIGH  | `rate-limit.ts` + 5 routes               |
| 7   | ✅ **DS12** — Test endpoint пише `logAudit` (provider, hadClientConfig, IP). Слід зловмисника лишається навіть на success                                                                                                             | 🟢 LOW   | `delivery-settings/test/route.ts`        |

## Бонус / residual

- ✅ **DS7** — `maskValue(key, value, leakyOk)`: admin бачить `first4••••last4`, manager — лише `••••••••` (захист від edge-fingerprinting при session hijack) | `delivery-settings/route.ts:34-58` |
- ✅ **DS8** — Bracketed `invalidateSettingsCache()` (BEFORE + AFTER upsert) — concurrent reader під час save обов'язково йде в DB | `delivery-settings/route.ts:108-110, 138-145` |
- ⚠️ **DS9** — Перевірено: NP service використовує direct API calls для cities/warehouses (немає cache). User-saved Ref UUIDs живуть в Order.deliveryCity/Warehouse — auto-refresh не доречний (це shipping data, не cache). Запис DS9 → не actionable, скасовано |
- ⏸️ **DS10** — Skip: random salt for encryption потребує migration усіх існуючих encrypted secrets (payment + delivery + integrations). Окрема security-sweep задача |
- ✅ **DS11** — Estimate cache-key normalize: `weight.toFixed(1)` + `total.toFixed(2)` — float-drift `1.1` vs `1.1000000000000001` більше не cache-miss'ить | `delivery/estimate/route.ts:54-58` |
- ✅ **DS13** — UX hint biggerу: «**окремий конфіг** (свої тарифи, ваговий клас, мін.сума). API ключ Нової Пошти переписується з цього розділу, але всі інші параметри окремі» | `delivery-settings/page.tsx:329` |

## Свідомо відкладено

- NP account balance API integration (потребує знайти і додати GET endpoint у NP, документація обмежена)
- Multi-warehouse "current sender" logic (бізнес-decision)

## Бонус / residual

- DS7 — restrict GET delivery-settings до admin-only (manager стрипано)
- DS8 — atomic save+invalidate (transaction-safe)
- DS9 — NP Ref refresh endpoint для admin'а
- DS10 — random salt for encryption key (potentially needs migration if existing data)
- DS11 — estimate cache key normalize
- DS13 — UX hint: «pallet uses separate config»

## Свідомо відкладено

- NP account balance API integration (потребує знайти і додати GET endpoint)
- Multi-warehouse "current sender" logic (бізнес-decision)
