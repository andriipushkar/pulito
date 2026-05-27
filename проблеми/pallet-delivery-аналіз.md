# «Pallet-delivery» (палетна доставка + lifecycle) — ТОП-7

| #   | Severity | Що                                                                                                                                                |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| PD1 | 🔴 HIGH  | Public `POST /delivery/pallet/calculate` без rate-limit + без cache — competitor може за хвилину enumerate tariff по всіх регіонах/вагах          |
| PD2 | 🔴 HIGH  | `logAudit` відсутній на POST/PUT/DELETE/orders mutations — тільки status має. Compliance gap: хто/коли створив/змінив/видалив палету — нема сліду |
| PD3 | 🟠 HIGH  | `addOrdersToPallet` check-then-create race без transaction — одночасний add того ж order на дві палети може пройти обидва checks                  |
| PD4 | 🟠 HIGH  | `setPalletStatus` race: read-then-update без `updateMany WHERE current_status` → паралельні calls можуть скасувати уже доставлену палету          |
| PD5 | 🟡 MED   | `weightKg.positive()` без верхньої межі — Decimal(8,2) overflow на 999999.99kg; multiplier diskрет step відсутній; добавити `max(50000)`          |
| PD6 | 🟡 MED   | `listPallets` `as never` cast — admin може передати `?status=anything`, Prisma silently filter → empty list. Validate enum                        |
| PD7 | 🟡 MED   | List endpoint `take: 200` без `?page` `?limit` — на 500+ палет UI freeze; nested orders unbounded count                                           |

## Background

`Pallet` — група orders для палетної логістики. `PalletOrder` — many-to-many JOIN. Lifecycle: `forming → in_transit → delivered/cancelled`. Public calculator відкритий для оцінки доставки на checkout.
