# «Settings» (general site settings + AI test) — ТОП-5

| #     | Severity | Що                                                                                                          |
| ----- | -------- | ----------------------------------------------------------------------------------------------------------- |
| ST_S1 | 🟠 HIGH  | `/test-ai` без rate-limit — кожен виклик платний (Claude/Gemini token). Stolen session може burn API budget |
| ST_S2 | 🟠 HIGH  | `/test-ai` без `logAudit` — admin може probe custom apiKey (potentially attacker key) без сліду             |
| ST_S3 | 🟠 MED   | PUT приймає `entries` без типобезпечного Zod — лише key allow-list, але значення raw string                 |
| ST_S4 | 🟡 MED   | PUT audit details містить тільки `changedKeys` — нема before-snapshot для diff                              |
| ST_S5 | 🟡 MED   | Negative check лише для `free_delivery_threshold`/`min_order_amount`. Інші numeric keys ламаються silently  |
