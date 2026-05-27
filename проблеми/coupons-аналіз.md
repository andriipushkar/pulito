# «Coupons» (`/admin/coupons`) — ТОП-7

| #   | Severity | Що                                                                        |
| --- | -------- | ------------------------------------------------------------------------- |
| CP1 | 🔴 HIGH  | Public `/coupons/validate` без rate-limit — brute-force enumeration       |
| CP2 | 🟠 HIGH  | `validate` пройшло, `redeem` race може дати дві redempt'и на usageLimit-1 |
| CP3 | 🟠 HIGH  | Percent > 100 silently clamp'иться без error → admin не знає              |
| CP4 | 🟠 MED   | Auto-disable на usageLimit досягненні відсутній                           |
| CP5 | 🟡 MED   | Per-redemption audit-log відсутній                                        |
| CP6 | 🟡 MED   | Product restrictions bypassed якщо `cartProductIds` undefined             |
| CP7 | 🟢 LOW   | Validation TZ-aware datetime (server local)                               |
