# «Email-templates» (transactional/marketing template CRUD + test) — ТОП-5

| #   | Severity | Що                                                                                                                                                                |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ET1 | 🟠 HIGH  | `[id]/test` приймає `email` без Zod email validation і без rate-limit — admin може запустити тест-флуд на arbitrary recipient (e.g. competitor's inbox)           |
| ET2 | 🟠 MED   | `[id]/test` без `logAudit` — abuse трекінг неможливий; sent test emails не показуються у admin journal                                                            |
| ET3 | 🟡 MED   | POST без length cap на `subject`/`bodyHtml` (PUT має тільки на subject 1-300). Admin може зберегти 10MB body                                                      |
| ET4 | 🟡 MED   | `subject` зберігається raw — admin може ввести `<script>...</script>` у subject. Subject mailto-encoded, але деякі mail clients show raw → defence-in-depth strip |
| ET5 | 🟢 LOW   | `bodyText` без length cap у PUT — admin може зберегти 10MB plaintext                                                                                              |
