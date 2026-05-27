# «Moderation» (Telegram/Viber rules + logs) — ТОП-7

| #   | Severity | Що                                                                                                                                                         |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MD1 | 🔴 HIGH  | POST `/moderation/rules` — **створення правила без `logAudit`**. Rule з `action='ban'` забанює користувача — must be auditable хто/коли створив            |
| MD2 | 🔴 HIGH  | POST приймає `body.config` БЕЗ розміру cap (PUT має 16KB cap). Admin може створити правило з 10MB JSON config → DB bloat                                   |
| MD3 | 🟠 HIGH  | Inline manual `if (!validPlatforms.includes(...))` validation замість Zod. POST і PUT drift — PUT має config cap і `Object.keys` audit, POST — ні          |
| MD4 | 🟠 MED   | PATCH `/moderation/logs` `body.id = Number(body.id)` без guard — `NaN` → Prisma P2025/500. `isFalsePositive` flip = policy override, без `logAudit`        |
| MD5 | 🟡 MED   | PUT `[id]` — Prisma `.update` без preceding `findUnique` — для неіснуючого id кидає P2025 → 500 замість friendly 404                                       |
| MD6 | 🟡 MED   | POST rule — нема duplicate guard `@@unique(platform, ruleType)` + config hash. Дві однакові правила на той самий platform/type створює confusion в обробці |
| MD7 | 🟢 LOW   | DELETE rule — Prisma default `SetNull` на logs.ruleId (FK optional). OK technically, але `logAudit.details` не записує `affectedLogs count` для forensics  |

## Background

Bot moderation для Telegram/Viber. `ModerationRule` (platform, ruleType, action, config JSON). `ModerationLog` зберігає кожен trigger (user, original message, action taken). Admin позначає false positives.
