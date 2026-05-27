# «Import» (bulk CSV/XLSX/YML upload + rollback) — ТОП-7

| #   | Severity | Що                                                                                                                                                                                |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IM1 | 🔴 HIGH  | Rate-limit відсутній на usіх import endpoints (products/prices/images/preview×2). Admin endpoint, але stuck UI button + 10MB file × N циклів = OOM/disk fill                      |
| IM2 | 🔴 HIGH  | **CSV formula injection** — string cells що починаються з `=`, `@`, `+`, `-` зберігаються as-is і re-export як CSV → RCE у Excel/LibreOffice коли інший admin/тех відкриє експорт |
| IM3 | 🔴 HIGH  | **XXE** — `XMLParser` без `processEntities: false` → YML feed з `<!ENTITY xxe SYSTEM "file:///etc/passwd">` читає файли host-системи                                              |
| IM4 | 🟠 HIGH  | Image download — content-type перевіряється тільки за header. Attacker serves PHP/HTML payload as `image/jpeg`. Sharp catches більшість, але explicit magic-byte guard cleaner    |
| IM5 | 🟠 MED   | `parsePrice` reject тільки `< 0` — `0` проходить → free products (priceRetail=0); схема `Float`/Decimal не блокує                                                                 |
| IM6 | 🟡 MED   | ImportLog audit без file SHA-256 — той самий filename з різним content неможливо відрізнити для rollback forensics                                                                |
| IM7 | 🟡 MED   | Row content fields (`description`, `specifications`) без length cap — 10MB рядок у XLSX → DB bloat / OOM                                                                          |

## Background

Bulk-import flow: admin uploads XLSX/CSV/XML/YML → preview → import → audit log → optional rollback. File parsing happens server-side; YML/XML parser має SSRF surface. Image-import окремий endpoint який pulls remote images (вже має isAllowedUrl gard + sharp).
