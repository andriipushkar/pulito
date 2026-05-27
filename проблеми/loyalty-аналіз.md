# «Loyalty» (`/admin/loyalty`) — ТОП-7

| #   | Severity | Що                                                                     |
| --- | -------- | ---------------------------------------------------------------------- |
| L1  | 🔴 HIGH  | Manual adjust без idempotency — double-submit = double points          |
| L2  | 🔴 HIGH  | Manual adjust без audit-log — fraud/compliance gap                     |
| L3  | 🟠 HIGH  | Adjust validator без max cap — admin може додати 1M points             |
| L4  | 🟠 HIGH  | UI кнопка adjust без isLoading — fast double-click pass                |
| L5  | 🟡 MED   | Expiry cron без withCronLock — overlapping runs double-expire          |
| L6  | 🟡 MED   | Settings update без history — pointsMultiplier діє ретроактивно мовчки |
| L7  | 🟡 MED   | Points balance може стати negative (add path без check)                |
