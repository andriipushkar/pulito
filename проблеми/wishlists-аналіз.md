# «Wishlists» (customer wishlists CRUD) — ТОП-3

| #   | Severity | Що                                                                                                                 |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| WL1 | 🟡 MED   | POST `createWishlist` без cap на кількість per-user — customer може створити 10000 списків через скрипт → DB bloat |
| WL2 | 🟡 MED   | POST + DELETE без rate-limit — spam-loop може створити/видаляти списки на швидкості                                |
| WL3 | 🟢 LOW   | DELETE без `logAudit` — менш критично (тільки user-own data), але GDPR-related                                     |
