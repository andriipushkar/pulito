# «Feedback» (contact form + callback + admin replies) — ТОП-7

| #   | Severity | Що                                                                                                                                                                                                  |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FB1 | 🔴 HIGH  | `PUT /admin/feedback/[id]` (зміна status на `rejected`/`processed`) — **без `logAudit`**. Compliance gap: менеджер може mass-reject скарги без сліду                                                |
| FB2 | 🟠 HIGH  | `sendFeedbackReply` — нема перевірки status: admin може двічі надіслати email на одне feedback (feedback вже `processed`). Customer спам                                                            |
| FB3 | 🟠 MED   | `notifyManagersOfNewFeedback` — fetch усіх active admin+manager без cap. 50 managers × кожен submit = 50 sendEmail. Storm risk                                                                      |
| FB4 | 🟡 MED   | `POST /feedback` (public) не зберігає `ipAddress` / `userAgent` — forensics зламані; спам-burst неможливо trace                                                                                     |
| FB5 | 🟡 MED   | `getFeedbackList` `search` фільтрує тільки `name` + `email`, не `phone` чи `message`. Admin шукаючи скаргу по тексту не знайде                                                                      |
| FB6 | 🟡 MED   | Validator `subject: z.string().max(200).optional()` без `min(1)` / `.trim()` — приймає `"   "` whitespace, потім у нотифікації `[форма]   - Ім'я`                                                   |
| FB7 | 🟢 LOW   | `notifyManagersOfNewFeedback` HTML email — `${APP_URL}/admin/feedback` link з env. Якщо APP_URL компроментовано (`javascript:...`), manager click → execute. Low risk але `isSafeUrl` guard дешевий |

## Background

Feedback flow: public POST `/feedback` → DB row + Telegram + email-storm до admins/managers. Admin UI: list, status PUT, reply email send.
