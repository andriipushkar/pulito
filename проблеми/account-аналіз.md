# «Account» (customer cabinet — account+addresses+gdpr) — ТОП-5

| #   | Severity | Що                                                                                                                                               |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1 | 🟠 HIGH  | `DELETE /me/account` (видалення власного акаунта) без `logAudit` — компromise/incident timeline невідновлюваний                                  |
| AC2 | 🟠 HIGH  | `DELETE /me/account` без rate-limit — bcrypt порівняння повільне, але без cap password brute-force теоретично можливий через тіло DELETE         |
| AC3 | 🟠 MED   | `addresses` POST/PUT — `city/street/building/apartment` без length cap (тільки label.max(50)). Customer може зберегти 10MB у поле адреси         |
| AC4 | 🟡 MED   | `updateAddress` isDefault race: `findFirst` → `updateMany` → `update` без `$transaction`. Паралельні запити можуть лишити 0 або 2 default        |
| AC5 | 🟡 MED   | `createAddress` POST — `isDefault: true` без deactivation попередніх default (на відміну від PUT). Customer може мати кілька isDefault addresses |
