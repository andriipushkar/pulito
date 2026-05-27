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
