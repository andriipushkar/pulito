# «Ask» (NL admin router) — ТОП-5

| #   | Severity    | Що                                                                                                                                                                                                                                                                          |
| --- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | 🟠 MED-HIGH | `router.push(intent.url)` без allow-list. Зараз усі rules hard-coded `/admin/...`, але код-коментар «If/when @anthropic-ai/sdk lands, swap matchIntent for a Claude call» — LLM зможе повернути `intent.url = '/api/...'` або `https://evil.com` → open-redirect / phishing |
| AK2 | 🟡 MED      | Input не cap-нутий — користувач може вставити 10MB рядок, regex eval на кожне rule + render у `<input value=...>` → UI freeze                                                                                                                                               |
| AK3 | 🟡 MED      | Phone regex `\d{7,}` занадто loose — захоплює timestamps, order numbers, order code-частини. Шукаючи «Замовлення 12345678» юзер потрапить у пошук за номером телефону «12345678»                                                                                            |
| AK4 | 🟢 LOW      | `today()` / `daysAgo()` використовують UTC `toISOString().slice(0, 10)` — для админа з UTC+2/+3 «сьогодні» дрейфує на «вчора» після 22:00 Kyiv                                                                                                                              |
| AK5 | 🟢 LOW      | Input не стрипається від control chars — RTL override, null bytes можуть візуально зламати UI                                                                                                                                                                               |

## Background

`/admin/ask` — клієнтський NL-маршрутизатор, без серверного endpoint. `matchIntent()` — pure function, regex-based. Зміни тільки у services/nl-router.ts + page.tsx.
