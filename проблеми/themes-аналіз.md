# «Themes» (storefront theme ZIP upload + customSettings) — ТОП-5

| #   | Severity | Що                                                                                                                                       |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| TH1 | 🟠 MED   | `uploadTheme` має zip-slip guard, але НЕ декомпресований розмір — admin може upload 10MB zip-бомбу що розгортається в 10GB → диск повний |
| TH2 | 🟠 MED   | Re-upload поверх активної теми robotom replace-ить файли in-place (live theme swap) — без deactivation, race з storefront рендером       |
| TH3 | 🟡 MED   | `updateThemeSettings` audit без before-snapshot — flip кольорів/радіусів не traceable                                                    |
| TH4 | 🟡 MED   | `customSettings` без cap на кількість ключів — admin може передати 10000 ключів, кожен валідний, але DB JSON bloat                       |
| TH5 | 🟡 MED   | PUT `[id]` валідація inline (`typeof === 'object'`) — Zod schema для consistency                                                         |
