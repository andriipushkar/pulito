# «SMTP-settings» (transactional email config) — ТОП-5

| #   | Severity | Що                                                                                                                                                        |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SM1 | 🟠 HIGH  | PUT без Zod — `smtp_port`/`max_file_size_mb` приймають будь-який рядок, потенційна type confusion при `Number()` coercion downstream                      |
| SM2 | 🟠 MED   | `test/route.ts` rate-limit у in-memory `Map` — не серіалізує між Node instances. Має бути Redis-backed `checkRateLimit` (consistent with other endpoints) |
| SM3 | 🟠 MED   | PUT без before-snapshot у audit — admin flip `smtp_host` на attacker-controlled SMTP без traceability на старе значення                                   |
| SM4 | 🟡 MED   | `body.smtp_secure` accepts `'true'`/`'false'` strings — inconsistent type. Має бути boolean у Zod                                                         |
| SM5 | 🟢 LOW   | maskValue показує первый/останній 3 символи короткого пароля — reversible для weak passwords                                                              |
