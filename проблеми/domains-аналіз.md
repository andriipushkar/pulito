# «Domains» (custom tenant domain + DNS verification) — ТОП-5

| #   | Severity | Що                                                                                                                                      |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| DM1 | 🟠 HIGH  | DELETE `/domains/[domain]` без `logAudit` — admin прибирає кастомний домен (sensitive: customer-facing URL змінюється) без traceability |
| DM2 | 🟠 MED   | POST `/verify` без rate-limit — admin/bot може hit DNS lookup необмежено → upstream DoS, also може enumerate verification status        |
| DM3 | 🟡 MED   | `verifyDomain` returns `false` для будь-якого DNS error без logging — admin не розуміє чи NXDOMAIN, timeout, чи запис не співпадає      |
| DM4 | 🟡 MED   | `dns.resolveTxt` без timeout — повільний/недоступний DNS resolver може зависнути endpoint на 30+ сек                                    |
| DM5 | 🟢 LOW   | `domainVerificationToken` не clear-иться після успішної верифікації — старий токен лежить у DB                                          |
