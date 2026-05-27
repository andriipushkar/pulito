# «Reports» (admin reports generator + builder) — ТОП-5

| #    | Severity | Що                                                                                                                            |
| ---- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| RPT1 | 🟠 HIGH  | `/generate` POST без rate-limit — XLSX/PDF render важкий, stuck UI / stolen session може DoS dispatcher                       |
| RPT2 | 🟠 MED   | `/builder` POST без `logAudit` — report on customer/order data = GDPR-relevant, треба traceable                               |
| RPT3 | 🟡 MED   | `/builder` inline `typeof === 'string'` валідація замість Zod schema                                                          |
| RPT4 | 🟡 MED   | `/generate` audit details містить `fieldsCount`, але не самі fields — for GDPR audit потрібен повний список запитаних колонок |
| RPT5 | 🟢 LOW   | `params.filters` Zod `z.record(z.unknown())` без max-keys cap — admin може передати 10000 filter keys                         |
