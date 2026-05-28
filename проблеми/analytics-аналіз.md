# Аналіз «Analytics» (`/admin/analytics`) — 17 endpoints + 886 LOC dashboard

## ТОП-7

| #   | Що                                                    | Severity    |
| --- | ----------------------------------------------------- | ----------- |
| AN1 | Heatmap loads 50k orders без paging — OOM на >50k     | 🔴 HIGH     |
| AN2 | Churn loads ENTIRE customer base без date filter      | 🔴 HIGH     |
| AN3 | RFM groupBy без take — OOM на >100k customers         | 🟠 MED-HIGH |
| AN4 | CSV export productName без escape (formula injection) | 🟠 MED      |
| AN5 | Geography groups all cities без paging                | 🟠 MED      |
| AN6 | PDF exports без cap on per-day quota                  | 🟡 MED      |
| AN7 | Manager бачить full customer LTV (emails+names)       | 🟡 MED      |

## Re-audit 2026-05-28 (AN8–AN15) — commit 929fcd7

| #    | Що                                                                                               | Severity | Статус                                                                   |
| ---- | ------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------ |
| AN8  | Digest email вставляє productCode/productName у HTML без escape (stored XSS у пошті)             | 🔴 HIGH  | ✅ `escapeHtml()` у analytics-digest.ts                                  |
| AN9  | `getCustomerSegmentation` groupBy+findMany по ВСІЙ базі клієнтів без date filter → OOM           | 🔴 HIGH  | ✅ date-вікно (default 365д, `segments?days=`)                           |
| AN11 | 3 analytics cron (precompute/digest/alerts) без `withCronLock` → double-fire дублює листи/алерти | 🔴 HIGH  | ✅ `withCronLock` на всі три (digest — per-period)                       |
| AN10 | Важкі scan-endpoints (cohorts/abc/rfm/churn/segments) без rate-limit                             | 🟠 MED   | ✅ `checkRateLimit(RATE_LIMITS.admin)` per-user на всі п'ять             |
| AN12 | «off-by-one date math у getPeriods»                                                              | —        | ❌ false alarm — JS `setDate(getDate()-days)` коректно нормалізує місяць |
| AN13 | «HTML injection у PDF»                                                                           | —        | ❌ false alarm — PDFKit не рендерить HTML                                |
| AN14 | `pctChange` повертає null коли previous=0                                                        | 🟢 LOW   | skip — null = «немає порівняння», коректно                               |
| AN15 | performance endpoint без пагінації                                                               | 🟢 LOW   | skip — низька цінність                                                   |
