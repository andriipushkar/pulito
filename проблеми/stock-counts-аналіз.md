# «Stock-counts» (інвентаризація + scanner) — ТОП-7

| #   | Severity | Що                                                                                                                                                                                             |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC1 | 🔴 HIGH  | `completeStockCount` без advisory lock — concurrent з order fulfillment / manual stock update може дати lost-write на закритті інвентаризації (one tx упускає update від іншої)                |
| SC2 | 🔴 HIGH  | **Inventory CRITICAL bug:** `completeStockCount` робить `reserved: 0` для УСІХ stock — товари з активними замовленнями (reserved>0) втрачають reservation → orders fulfill порожнім → oversell |
| SC3 | 🔴 HIGH  | Scanner bug: scan handler шле `qty=1` per scan, але `recordCount` `SET countedQty` (не increment). Сканування продукту 5 разів = counted=1 на closing → variance = -4 → minus stock            |
| SC4 | 🟠 HIGH  | Scan endpoint без rate-limit — physical scanner може ляснути 50 req/sec; випадковий double-scan multiplied by N → flood                                                                        |
| SC5 | 🟡 MED   | `startStockCount` не перевіряє чи вже є `in_progress` count на цьому warehouse — два паралельних count = два apply на close → chaos                                                            |
| SC6 | 🟡 MED   | POST/PUT/scan — ручний `Number()`/`String()` без Zod schema; легко drift                                                                                                                       |
| SC7 | 🟢 LOW   | Reference suffix `randomBytes(2)` (65k combos) — collision ризик на масштабі                                                                                                                   |

## Background

`StockCount` = інвентаризаційний документ. `start` snapshot-ить current quantities як `expectedQty`. Operator сканує штучки → `recordCount` (зараз `SET` countedQty). `complete` пише `counted → WarehouseStock.quantity` + reset reserved=0. Цей reset — головна проблема для будь-якого товару з активним замовленням.
