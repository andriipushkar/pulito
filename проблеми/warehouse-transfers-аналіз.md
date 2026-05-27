# «Warehouse-transfers» (переміщення між складами) — ТОП-7

| #   | Severity | Що                                                                                                                                                                                               |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| WT1 | 🔴 HIGH  | `items` array без `.max(N)` на POST — admin може створити transfer на 10000 позицій → nested `create` усередині `prisma.warehouseTransfer.create()` exhaust DB + payload bloat                   |
| WT2 | 🔴 HIGH  | POST + PUT валідовані ручним кодом замість Zod — inline `Number()` checks легко drift від service-level. Один пропуск = bypass                                                                   |
| WT3 | 🟠 HIGH  | `shipTransfer` / `receiveTransfer` без advisory lock — concurrent з admin manual stock update може дати lost-write (читання-decrement з різних транзакцій конфліктують)                          |
| WT4 | 🟠 HIGH  | `createTransfer` валідує тільки що products існують. Pre-flight stock check відсутній — admin створює draft з кількістю більше залишку, помилка спливає лише при ship → UX збиток                |
| WT5 | 🟡 MED   | POST без rate-limit. Heavy operation (validate FKs + create transfer з nested items + audit)                                                                                                     |
| WT6 | 🟡 MED   | `cancelTransfer` робить тільки `draft` cancel. Якщо transfer вже `in_transit` (reserved заблоковано), нема способу безпечно повернути reserved → quantity. Adminу доводиться маніпулювати raw БД |
| WT7 | 🟢 LOW   | `generateReference()` використовує 4 hex chars (~65k combos). За 18k transfers/рік ризик collision росте; `prisma.create` кине unique-error але повторити складно                                |
