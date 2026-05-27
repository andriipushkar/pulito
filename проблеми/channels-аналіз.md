# «Channels» (channel config, marketplace credentials, test conn) — ТОП-6

| #   | Severity | Що                                                                                                                                                                                                 |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CH1 | 🔴 HIGH  | `POST /channel-settings/test` без rate-limit — кожен виклик робить external fetch (Telegram/Viber/FB/IG/TikTok/OLX/Rozetka/Prom/Epicentr). Stuck UI або stolen session = credential-stuffing бомба |
| CH2 | 🟠 HIGH  | `test/route.ts` приймає `config` from body БЕЗ Zod schema (на відміну від PUT). Admin може пейлоадити test з custom-shape config → unbounded external fetches                                      |
| CH3 | 🟠 MED   | `marketplaceSchema.passthrough()` дозволяє довільні extra fields → DB bloat і потенційні SSRF поля (якщо service пізніше прочитає custom URL)                                                      |
| CH4 | 🟡 MED   | Test endpoint без `logAudit` — admin testing зовнішніх систем з токенами без сліду                                                                                                                 |
| CH5 | 🟡 MED   | `errorResponse('Невідомий канал')` без status code → defaults до 500 замість 400. Той самий bug у PUT і test                                                                                       |
| CH6 | 🟢 LOW   | Viber `getEnvFallback` юзає `process.env.VIBER_AUTH_TOKEN` напряму, не `env.VIBER_AUTH_TOKEN` — inconsistent з рештою                                                                              |
