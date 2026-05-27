# Аналіз розділу «Audit Log» (`/admin/audit-log`)

| #      | Тема                                                                                         | Файл                                              | Severity              |
| ------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------- | ------- |
| **A1** | Cleanup cron видаляє >365 днів — UA «Закон про бухоблік» вимагає 3 роки для фінансових подій | `cleanup-audit-log/route.ts`, `services/jobs/...` | 🔴 HIGH               |
| **A2** | Manager-role бачить весь audit (включно зі змінами ролей, паролів)                           | `audit-log/route.ts:8`                            | 🔴 HIGH               |
| **A3** | Export rate 10/min + 10k rows/req → 10MB PII/6s — обхідний канал для exfil                   | `export/route.ts:51`                              | 🟠 HIGH               |
| **A4** | CSV-injection: `fullName` не екрановане — `=cmd                                              | ...` працює у Excel                               | `export/route.ts:119` | 🟠 HIGH |
| **A5** | Pagination offset attack: page=1M → 20M skip → slow scan                                     | `route.ts:62`                                     | 🟡 MED                |
| **A6** | Cleanup cron на `APP_SECRET` (mirror PS12)                                                   | `cleanup-audit-log/route.ts:10-12`                | 🟡 MED                |
| **A7** | No entity-ID drilldown search                                                                | `page.tsx`                                        | 🟢 LOW UX             |
| A8     | entityId missing з export filters                                                            | `page.tsx:278`                                    | 🟢 LOW                |
| A9     | Date range без TZ                                                                            | `route.ts:51`                                     | 🟢 LOW                |
| A10    | Cleanup cron не пише audit-log про себе                                                      | `cleanup-audit-log/route.ts`                      | 🟢 LOW                |
| A11    | Mobile hides entityType/entityId/IP                                                          | `page.tsx:455`                                    | 🟢 LOW UX             |
| A12    | Bulk diff rendering = JSON dump                                                              | `AuditDiff.tsx`                                   | 🟢 LOW UX             |

## ТОП-7

1. A1 — retention 3 роки для financial actions
2. A2 — admin-only view (manager стрипано)
3. A3 — export row-cap зменшити + per-day limit
4. A4 — CSV injection escape
5. A5 — page max 10k
6. A6 — CRON_SECRET
7. A10 — cleanup пише про себе у audit
