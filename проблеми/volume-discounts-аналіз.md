# «Volume Discounts» (`/admin/volume-discounts`) — ТОП-7

| #   | Severity    | Що                                                                                                              |
| --- | ----------- | --------------------------------------------------------------------------------------------------------------- |
| VD1 | 🟠 HIGH     | `discountPercent Float` в schema — money precision drift (migrate to Decimal)                                   |
| VD2 | 🟠 MED-HIGH | Update audit без before/after diff                                                                              |
| VD3 | 🟡 MED      | Overlapping quantity ranges для одного product не detect'аться при create (5-10 + 8-15 — обидва match на qty=9) |
| VD4 | 🟡 MED      | Update endpoint не має dupe-check на (productId, categoryId, minQuantity) — admin може створити дубль           |
| VD5 | ✅ Wired    | `applyVolumeDiscounts` коректно викликається з cart.ts:100 — НЕ dead-code                                       |
| VD6 | 🟢 LOW      | Немає auto-disable на endsAt expiry                                                                             |
| VD7 | 🟢 LOW      | Bulk-import відсутній — кожне правило вручну                                                                    |
