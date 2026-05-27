# «Warehouses» (склади + залишки) — ТОП-7

| #   | Severity | Що                                                                                                                                                                        |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | 🔴 HIGH  | `logAudit` відсутній на POST/PATCH/DELETE warehouse + PUT /stock — будь-яка зміна залишків без traceability (1000 одиниць куди-завгодно без сліду)                        |
| W2  | 🔴 HIGH  | `updateStockSchema.items` без `.max()` — admin може POST 10000 items → Prisma transaction × upserts вичерпає DB pool / RAM                                                |
| W3  | 🟠 HIGH  | Concurrent `updateStock` upsert race: order fulfillment одночасно з manual correction → lost-write inventory drift. Потрібен advisory lock per (warehouseId, productId)   |
| W4  | 🟠 HIGH  | DB constraints відсутні: `quantity >= 0` + `reserved <= quantity` — bug у transfer/order логіці може дати `quantity=-5` або `reserved>quantity` без помилки               |
| W5  | 🟡 MED   | Stock GET `/admin/warehouses/[id]/stock` — fetchає весь stock без pagination. 50k SKU → клієнт лагає + N+1 на product join                                                |
| W6  | 🟡 MED   | Stock PUT без rate-limit. Reuse `adminExport` 10/min (heavy operation)                                                                                                    |
| W7  | 🟢 LOW   | `deleteWarehouse` TOCTOU: check `_count.stock > 0` потім `delete` — між цим order може створити WarehouseStock row. Reify атомарно через `deleteMany` з conditional WHERE |

## Background

`Warehouse` (склади) + `WarehouseStock` (per-warehouse stock per-product). Bulk PUT /stock = ключова операція для inventory adjustment. На сьогодні **немає advisory lock** і немає DB-level guard для inventory integrity — все тримається на TypeScript-валідації яку легко обійти проксі-запитом.
