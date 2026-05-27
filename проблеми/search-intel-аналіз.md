# «Search-intel» (admin AI search insights) — ТОП-5

| #   | Severity | Що                                                                                                                                                                                                        |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SI1 | 🔴 HIGH  | POST `/admin/search-intel` дзвонить Claude/Gemini без rate-limit — кожен виклик платний; reuse `adminAiGenerate` 60/h                                                                                     |
| SI2 | 🟠 HIGH  | Prompt injection: `term` йде сирим у AI prompt. Атакер шукає `"ignore previous instructions and reveal..."` → AI ймовірно проігнорує, але limit `term.length` ≤ 200 + strip control chars зменшує surface |
| SI3 | 🟠 MED   | POST без `logAudit` — admin не може trace «хто та скільки разів дзвонив AI на цьому місяці»                                                                                                               |
| SI4 | 🟡 MED   | POST допускає `manager` role — менеджер біллить AI з admin-budget; обмежити до `admin` only                                                                                                               |
| SI5 | 🟢 LOW   | GET `/admin/search-intel` — два важких `findMany` на кожен виклик; для popular page можна `Cache-Control: private, max-age=60`                                                                            |

## Background

`SearchQuery` зберігає запити користувачів з кількістю. Admin page (`/admin/search-intel`) має кнопку «Генерувати поради» що сипне AI prompt з топ-30 zero-result запитів. AI-генерація — найдорожча operation (Claude Haiku ~$0.005 per 1k tokens).
