# «Setup-2FA» (TOTP enable/verify/disable) — ТОП-4

| #   | Severity | Що                                                                                                                                                                                                                                   |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TF1 | 🟠 MED   | `setup` POST (generate secret) без `logAudit` — verify/disable мають audit, setup — ні. Якщо secret leaked, нема стартової точки для forensic timeline                                                                               |
| TF2 | 🟠 MED   | `setup` consistency gap: `withRole('admin','manager','client','wholesaler')`, але `verify` тільки `'admin','manager'` — customer setup-ить 2FA, але не може verify (зловмисники бачать customer 2FA-secret у DB і не блокують login) |
| TF3 | 🟡 MED   | `disable` без notify-email customer — admin/customer disable 2FA на власному акаунті → security event який має генерувати email notification (як LinkedIn/Google роблять)                                                            |
| TF4 | 🟡 MED   | `verify-login` rate-limit за tempToken suffix (last 16 chars) — двох різних tempToken можна підбирати з різних IP. Має бути per IP+username                                                                                          |
| TF5 | 🟢 LOW   | `twoFactorSecret` зберігається plaintext у DB — DB dump = compromise всіх tokens. Потрібна schema migration з encrypt() (defer — потребує live data migration)                                                                       |
