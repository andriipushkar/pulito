# «Publication-templates» (saved publication templates) — ТОП-5

| #   | Severity | Що                                                                                                                                                                                                         |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PT1 | 🟠 HIGH  | `buttons: unknown` приймається без validation — admin зберігає JSON, потім `applyTemplate` повертає його у Publication. Якщо button.url = `javascript:...` потрапляє у Telegram inline keyboard → phishing |
| PT2 | 🟠 MED   | Inline manual valid (`if (!input.name.trim())`) у service замість Zod — drift-prone, легко пропустити при додаванні поля                                                                                   |
| PT3 | 🟡 MED   | PUT + DELETE без `before/after` audit snapshot — admin flip `isActive: false` на live template не traceable                                                                                                |
| PT4 | 🟡 MED   | `POST /apply` без `logAudit` — admin застосовує template до конкретного productId, факт не записується (forensics для duplicate-post incidents)                                                            |
| PT5 | 🟢 LOW   | `contentTemplate`/`firstComment` без length cap — admin може зберегти 10MB string                                                                                                                          |
