# «Feeds» (RSS/XML/Google Shopping/Hotline) — ТОП-7

| #   | Severity | Що                                                                                                                                                                                          |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | 🔴 HIGH  | `/feed.xml`: `<category>${p.category?.name}</category>` БЕЗ escape — товар з категорією що містить `<`, `&`, `"` ламає XML; Google/Hotline де-індексує весь feed                            |
| F2  | 🔴 HIGH  | CDATA `]]>` injection: товар з назвою/описом, що містить `]]>` передчасно закриває `<![CDATA[...]]>` у `/feed.xml` і `/blog/feed.xml` — XML invalid, parser reject                          |
| F3  | 🟠 HIGH  | `/feed.xml` + `/feed/google-shopping` фільтрують тільки `isActive: true`, але НЕ `deletedAt: null` — soft-deleted товари йдуть у Google index → 404 → score penalty                         |
| F4  | 🟠 MED   | Public feeds без rate-limit. Аггрегатори poll кожні 30 хв, але bot може хіт `/feed/google-shopping` сотні разів за хвилину = N×5000 prisma JOIN + 200KB response                            |
| F5  | 🟡 MED   | XML control chars (`\x00-\x08`, `\x0B-\x0C`, `\x0E-\x1F`) не вирізаються — товар з табом/null-byte у назві → invalid XML                                                                    |
| F6  | 🟡 MED   | `Cache-Control` непослідовний: `/feed.xml` 3600s, `/blog/feed.xml` 600s, `/hotline.xml` 1800s, `/google-shopping` 3600s. Адмінка каже «30 хв». Узгодити на 1800s                            |
| F7  | 🟢 LOW   | `/blog/feed.xml` coverImage URL побудова без `isSafeUrl` guard — `javascript:` у coverImage → попадає в `<enclosure url=...>`. Validator/reader exploit вразливість малий, але feed invalid |

## Background

Чотири публічних feed routes — це SEO/marketing surface площа. Зламаний feed = Google Merchant suspend → втрата 30% органічного трафіку миттєво.
