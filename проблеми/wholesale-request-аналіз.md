# «Wholesale-request» (customer cabinet — apply for B2B status) — ТОП-5

| #   | Severity | Що                                                                                                                            |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| WR1 | 🟠 HIGH  | POST без Zod — `legalAddress`/`companyName`/інші raw without length cap, customer може зберегти 10MB                          |
| WR2 | 🟠 MED   | POST без rate-limit + audit — bot/stuck UI може спамити wholesale requests, managers тонуть у Telegram нотифікаціях           |
| WR3 | 🟠 MED   | POST status flip `wholesaleStatus: 'pending'` без `logAudit` — фінансова transition (потенційно дає wholesale rates) untraced |
| WR4 | 🟡 MED   | `edrpou` без UA regex validation — accepts будь-що, потім менеджер обробляє garbage                                           |
| WR5 | 🟡 MED   | `contactPersonPhone` без `^\+380\d{9}$` regex (інші форми мають) — drift                                                      |
