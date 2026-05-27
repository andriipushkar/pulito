# «Bot-settings» (bot schedule, replies, welcome) — ТОП-5

| #    | Severity | Що                                                                                                                                                                                    |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BOT1 | 🟠 HIGH  | `bot-replies` POST/PUT/DELETE без `logAudit` — admin може створити reply з phishing URL без сліду; bot шле customer повідомлення, видавши за shop                                     |
| BOT2 | 🟠 HIGH  | `bot-replies` PUT — `data.buttons` accepts arbitrary JSON; URL у buttons без `isSafeUrl` guard → phishing у customer chat. POST `bot-welcome` уже має `z.url()`, PUT bot-replies — ні |
| BOT3 | 🟡 MED   | `bot-replies/[id]` PUT inline `Number()`/`String()` без Zod; POST має Zod, drift                                                                                                      |
| BOT4 | 🟡 MED   | `triggerType='regex'` accepts user regex без length cap — `(.+)+$` стиль pattern → ReDoS у bot pipeline                                                                               |
| BOT5 | 🟡 MED   | `bot-welcome` POST/PUT приймає buttons[].url через `z.string().url()` що пропускає `javascript:` — same as publication-templates fix; treba isSafeUrl                                 |
