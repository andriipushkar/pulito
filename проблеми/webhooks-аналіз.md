# «Webhooks» (subscription endpoints + delivery retry) — ТОП-5

| #   | Severity | Що                                                                                                                                                                                |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WH1 | 🠠 HIGH   | PATCH+DELETE на `[id]` через `withRole('admin')` без 2FA. POST уже має `withRole2fa('admin')` — inconsistent. URL change → всі majbutní events ідуть attacker-controlled endpoint |
| WH2 | 🟠 HIGH  | PATCH+DELETE без `logAudit` — admin flip URL/events/isActive без trail. Forensics gap для webhook hijack                                                                          |
| WH3 | 🟡 MED   | PATCH без before-snapshot у audit (коли буде доданий) — потрібно для diff на URL hijack                                                                                           |
| WH4 | 🟡 MED   | PATCH/DELETE inline `Number()`, `typeof === 'string'` валідація — нема Zod, drift-prone                                                                                           |
| WH5 | 🟡 MED   | `[id]/retry` без rate-limit — admin може запустити 1000 retries на attacker URL → SSRF amplifier                                                                                  |
