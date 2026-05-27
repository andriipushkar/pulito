# Аналіз «Feature Flags» (`/admin/feature-flags`) і «Health» (`/admin/health`)

## ТОП-7 правок

| #   | Що                                                                                                  | Severity | Файл                                       |
| --- | --------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------ |
| 1   | **FFH1** Toggle critical feature flag без confirm → акцидентальний outage (payment, checkout)       | 🔴 HIGH  | `feature-flags/page.tsx:75-85`             |
| 2   | **FFH2** Race на `updateFlag` (read→modify→write без TX) — concurrent admin clobber'ить             | 🟠 HIGH  | `services/feature-flag.ts:90-103`          |
| 3   | **FFH3** Audit log на flag toggle тільки `fields: Object.keys(body)` — без old/new value            | 🟠 HIGH  | `admin/feature-flags/[key]/route.ts:39-50` |
| 4   | **FFH4** Public `/health` віддає Typesense host:port (мапа інфраструктури), без specific rate-limit | 🟠 HIGH  | `api/v1/health/route.ts:39-52`             |
| 5   | **FFH5** Public `/feature-flags/check` без cache headers + 100/60s shared limit — bot enumeration   | 🟡 MED   | `api/v1/feature-flags/check/route.ts`      |
| 6   | **FFH6** Stats endpoint O(users × flags) у пам'ять без paging — DoS на 100k+ users                  | 🟡 MED   | `feature-flags/stats/route.ts:28-61`       |
| 7   | **FFH7** Client-side optimistic flag update без conflict detection                                  | 🟡 MED   | `feature-flags/page.tsx:75-109`            |
