# «Campaigns» (`/admin/campaigns`) — ТОП-7

| #   | Severity | Що                                                                                         |
| --- | -------- | ------------------------------------------------------------------------------------------ |
| CM1 | 🔴 HIGH  | Unsubscribed status not honored — sends to opted-out users (GDPR/CAN-SPAM violation)       |
| CM2 | 🟠 HIGH  | "Send now" без preview recipient count / template — blind broadcast                        |
| CM3 | 🟠 HIGH  | runCampaignNow без re-send guard для recurring (admin може спамити same users)             |
| CM4 | 🟠 MED   | HTML sanitization тільки на template save, не на send (stored bypass)                      |
| CM5 | 🟡 MED   | Segment validation: невалідний RFM сегмент → 0 skipped, але lastRunAt update — silent fail |
| CM6 | 🟡 MED   | Send-now 409 на конкурентний клік без retry/queue UI — partial send risk                   |
| CM7 | 🟢 LOW   | Unsubscribe token deterministic per email — без rotation, O(n) validation scan             |

## Re-audit 2026-05-29 (CM8–CM10)

Перевірка коду: CM1 (unsubscribe-honor) ✅, CM3 (recurring re-send guard) ✅, escapeHtml на send ✅
(тобто CM4 фактично закрито — `{{fullName}}/{{email}}` екрануються при відправці), advisory-lock серіалізує
паралельні запуски (send-now → 409). Свіжий re-audit знайшов **функціональний** баг у джерелі одержувачів.

| #    | Severity | Що                                                                                                                                                                                                                                                                                                                   | Статус                                                                                                                     |
| ---- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| CM8  | 🔴 HIGH  | Кампанії беруть одержувачів з `getCustomerSegmentation().segments[].customers` — а це **аналітичний прев'ю-семпл, capped на 10** (analytics-reports.ts:638). Отже будь-яка розсилка сягає **≤10 людей на сегмент**, попри реальний `count`. Коментар на 194 зізнається «We need all users' IDs», але cap ігнорує це. | ✅ Додано uncapped `getAllSegmentUserIds`/`getSegmentUserIds`; `processCampaigns`+`runCampaignNow` беруть повну membership |
| CM9  | 🟠 MED   | `runCampaignNow` має власну мапу `RECURRING_WINDOW_MS` з ключами `daily/weekly/monthly` — а enum частот `once/weekly/biweekly/monthly`. Для **`biweekly`** ключа нема → fallback на **24 год** замість 14 днів → ручний «Send now» повторно розсилає всередині 14-денного вікна.                                     | ✅ Замінено на канонічну `FREQUENCY_MS` (biweekly враховано)                                                               |
| CM10 | —        | send-now нібито без rate-limit/idempotency → подвійна розсилка                                                                                                                                                                                                                                                       | ❌ FALSE — advisory-lock у `runCampaignNow` повертає 409 на конкурентний виклик; дедуп per rule+user+window                |

> Побічно: `getCustomerSegmentation` зрефакторено — класифікація винесена в чисту `classifySegment` (спільна
> для dashboard-семплу й uncapped-membership), поведінка dashboard без змін. Тести `campaign.test.ts` оновлено
> під нову залежність + домокано `subscriber.findMany`/`$queryRaw` (2 тести раніше падали передіснуюче) → 11/11 ✅.

> Не чіпали: CM2/CM6 (UX preview/queue), CM5 (silent fail на невалідному сегменті — валідатор `rfmSegment` enum
> уже блокує на create/update), CM7 (token rotation — низька цінність).
