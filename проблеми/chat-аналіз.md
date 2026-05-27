# «Chat» (admin live-chat moderation + message send) — ТОП-4

| #     | Severity | Що                                                                                                                                   |
| ----- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| CH_M1 | 🟠 HIGH  | PATCH (assign/resolve/close) і POST (send message as agent) без `logAudit` — compliance gap: agent відповіді до customers не tracked |
| CH_M2 | 🟠 HIGH  | `sendMessageSchema.attachmentUrl` через `z.url()` приймає `javascript:` — admin може надіслати customer phishing link                |
| CH_M3 | 🟡 MED   | POST message без rate-limit — hijack session може спамити customer chat                                                              |
| CH_M4 | 🟡 MED   | `assignAgent(agentId)` приймає будь-який user_id без role validation — admin може assign customer/wholesaler як agent                |
