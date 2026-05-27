# «Tenants» (multi-tenant admin) — ТОП-5

| #   | Severity | Що                                                                                                                                                           |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TN1 | 🟠 MED   | POST/PATCH catch на `message.includes('Unique constraint')` — fragile string-matching. Маємо `Prisma.PrismaClientKnownRequestError.code === 'P2002'`         |
| TN2 | 🟠 MED   | DELETE з `force: true` — катастрофічна операція (cascade на users) без before-snapshot у audit. Якщо force-deleted by mistake, нема даних про affected users |
| TN3 | 🟡 MED   | `slug` Zod без reserved-list — admin може створити slug `admin`/`api`/`auth` → колізія з internal routes                                                     |
| TN4 | 🟡 MED   | `domain` Zod не валідує hostname formate (тільки `.max(255)`) — accept-ить будь-що, потім `verifyDomain` падає                                               |
| TN5 | 🟡 MED   | PATCH audit details містить тільки `fields` (keys), без `before` snapshot — не tracking value changes                                                        |
| TN6 | 🟢 LOW   | `settings` JSON без розміру cap — admin може запхати 10MB JSON                                                                                               |
| TN7 | 🟢 LOW   | `logoUrl` без `isSafeUrl` guard — `javascript:` може потрапити, хоч Next/Image catch-ить runtime                                                             |
