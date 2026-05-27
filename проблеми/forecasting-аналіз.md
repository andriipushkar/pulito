# «Forecasting» (demand forecast / reorder suggestions) — ТОП-5

| #   | Severity | Що                                                                                                                                                                                                                          |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FC1 | 🟡 MED   | `?limit=-1`, `?leadTimeDays=-1`, `?bufferDays=-1` не клампаються до позитивних — Prisma `take: -1` кине помилку; від'ємний leadTime ламає `daysUntilOOS < leadTime` всю logic                                               |
| FC2 | 🟡 MED   | `prisma.product.findMany` без `deletedAt: null` — soft-deleted товари у forecast, admin даремно реордерить                                                                                                                  |
| FC3 | 🟡 MED   | `currentStock: p.quantity` повертає `Product.quantity` (legacy single-warehouse), але `daysUntilOOS` рахує з `available = warehouseStock.quantity - reserved`. UI бачить інконсистентність «stock=100 але run out за 2 дні» |
| FC4 | 🟡 MED   | 3 важких prisma calls (groupBy, findMany, groupBy) + memory sort кожен GET — додати `Cache-Control: private, max-age=300` (5 хв; forecast не міняється кожну хвилину)                                                       |
| FC5 | 🟢 LOW   | Manager бачить forecast — OK, але `over-stock` threshold захардкоджений на 180 днів. Для сезонних товарів (новорічні подарунки) це false alarm                                                                              |
