# «Not-found-log» (404 beacon + admin viewer) — ТОП-7

| #    | Severity | Що                                                                                                                                                                                                |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFL1 | 🔴 HIGH  | `/api/v1/log-404` без rate-limit — public endpoint що `upsert` рядки в БД. Bot може флудити унікальними paths → DB blot до мільйонів рядків                                                       |
| NFL2 | 🟠 HIGH  | Skip-list bot-probes неповний — пропускає `/.`, `/wp-`, `.php`, `.env`, `/cgi-bin/` але НЕ `/api/`, `/_next/`, `/static/`, `/favicon`, `/.well-known/` (часті 404 від crawler-ів)                 |
| NFL3 | 🟠 HIGH  | DELETE `?id=` без `id` → `deleteMany({})` ВЕСЬ лог без confirm token; на UI random клік — кінець історії broken-links                                                                             |
| NFL4 | 🟡 MED   | DELETE (single + bulk) без `logAudit` — admin не може trace «хто і коли стер записи»                                                                                                              |
| NFL5 | 🟡 MED   | `referrer`, `userAgent` пишуться raw з user-controlled body — admin UI має render-safety (React екранує), але `referrer` може містити `<script>` що при копіюванні в HTML email/Slack стає вектор |
| NFL6 | 🟡 MED   | Нема `requestId` / `ipAddress` — після фіксу broken-link важко доказати «справді customer-traffic чи bot»                                                                                         |
| NFL7 | 🟢 LOW   | Лог росте безкінечно — нема TTL/retention. Через рік на популярному сайті → 100k+ рядків, sort by `count` без index                                                                               |
