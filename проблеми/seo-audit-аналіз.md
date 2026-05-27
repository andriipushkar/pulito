# «SEO Audit» — ТОП-5

| #   | Severity | Що                                                                                                                                 |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| SA1 | 🔴 HIGH  | Cron auth на `APP_SECRET` — потрібен `CRON_SECRET` fallback                                                                        |
| SA2 | 🟠 HIGH  | Cron без `withCronLock` — overlapping runs race на seo_check_results                                                               |
| SA3 | 🟠 HIGH  | SSRF: `fetch(appUrl + '/product/...')` без `isSafeOutboundUrl` — якщо APP_URL = localhost:6379/169.254.169.254, crawl'ить internal |
| SA4 | 🟡 MED   | HEAD_CONCURRENCY=5 без backoff — self-DoS на сотні товарів                                                                         |
| SA5 | 🟢 LOW   | seo_check_results без TTL/cleanup — старі дані залишаються                                                                         |
