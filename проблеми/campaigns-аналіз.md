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
