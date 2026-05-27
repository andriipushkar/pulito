# «Pages» (CMS) — ТОП-6

| #   | Severity | Що                                                                                                   |
| --- | -------- | ---------------------------------------------------------------------------------------------------- |
| PG1 | 🔴 HIGH  | Reserved slug check відсутній — admin може створити slug `admin`/`api`/`auth` і перекрити routes     |
| PG2 | 🟠 HIGH  | DOMPurify дозволяє `style` без CSS-allowlist — XSS через `expression()`/`-moz-binding`/`javascript:` |
| PG3 | 🟠 HIGH  | Hard-delete (`deletedAt` нема) — публічні посилання вмирають на SEO без recovery                     |
| PG4 | 🟡 MED   | Public list/detail без rate-limit та caching headers                                                 |
| PG5 | 🟡 MED   | Slug uniqueness race на PUT — findUnique+update без TX                                               |
| PG6 | 🟢 LOW   | Audit log без before/after diff                                                                      |
