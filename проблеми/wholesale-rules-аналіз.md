# «Wholesale Rules» (`/admin/wholesale-rules`) — ТОП-7

| #   | Severity | Що                                                                                                          |
| --- | -------- | ----------------------------------------------------------------------------------------------------------- |
| WR1 | 🔴 HIGH  | POST/PUT приймають будь-який ruleType string (не enum) і негативні numbers                                  |
| WR2 | 🟠 HIGH  | Public `/api/v1/wholesale-rules` віддає ВСІ rules з product-specific minimums — leaking competitor strategy |
| WR3 | 🟠 MED   | Rule overlap: дублікати min_order_amount додаються (AND-logic) замість MAX                                  |
| WR4 | 🟡 MED   | PUT приймає arbitrary value без type/range — `min_order_amount: -500` пройде                                |
| WR5 | 🟡 MED   | Audit лише `create` без before/after diff — неможливо trace зміни                                           |
| WR6 | 🟢 LOW   | Race на конкурентні edit — без version/updatedAt check                                                      |
| WR7 | 🟢 LOW   | Немає validFrom/validUntil — admins не можуть scheduler-ити правила                                         |
