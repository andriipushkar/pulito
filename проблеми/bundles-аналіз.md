# «Bundles» — ТОП-7

| #   | Severity    | Що                                                                                                                              |
| --- | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| BD1 | 🟠 HIGH     | Bundle add-to-cart без stock-check ДО циклу — половина items додається, потім fail на out-of-stock → partial cart inconsistency |
| BD2 | 🟠 MED      | Bundle activation/deactivation без TX — checkActive race з addBundleToCart                                                      |
| BD3 | 🟡 MED      | Price drift: bundle discount % обчислюється на льоту з product.priceRetail — admin не видно якщо product price різко зростає    |
| BD4 | 🟡 MED      | Float arithmetic у calculateBundlePrice — drift на маленьких знижках                                                            |
| BD5 | 🟢 LOW      | No add-to-cart idempotency — двосуб'ємний запит подвоює                                                                         |
| BD6 | 🟢 LOW      | Немає block на recursive bundle (концептуально неможливо в схемі, але без явної guards)                                         |
| BD7 | ✅ verified | rate-limit є, slug unique є, audit log є                                                                                        |
