# «Publications» (scheduled social/marketplace posts) — ТОП-7

| #   | Severity | Що                                                                                                                                   |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ | --- | -------------------- |
| PB1 | 🔴 HIGH  | `/cron/publications` тільки APP_SECRET, нема `CRON_SECRET                                                                            |     | APP_SECRET` fallback |
| PB2 | 🔴 HIGH  | Cron публікує без `withCronLock` — два паралельних tick = duplicate posts на Telegram/Instagram/Viber                                |
| PB3 | 🔴 HIGH  | `[id]/publish` + `[id]/retry` без `logAudit` — критичні external-side-effect mutations не tracked                                    |
| PB4 | 🟠 HIGH  | `buttons[].url` без validation — admin може створити button з `javascript:` або internal IP → SSRF/phishing у Telegram inline button |
| PB5 | 🟠 MED   | POST `/admin/publications` приймає body без Zod schema і без `scheduledAt > now()` guard — admin може backdate                       |
| PB6 | 🟡 MED   | `channels: string[]` без enum validation — арбітрарні значення зберігаються у DB → confusion                                         |
| PB7 | 🟡 MED   | `imagePath` не validate — може містити `../etc/passwd` чи external URL → SSRF при `${appUrl}${imagePath}` композиції                 |
