# «Blog» — ТОП-6

| #   | Severity | Що                                                                      |
| --- | -------- | ----------------------------------------------------------------------- |
| BL1 | 🔴 HIGH  | AI-generate endpoint без rate-limit (як у products PR1 / categories C3) |
| BL2 | 🟠 HIGH  | Public `/api/v1/blog` + `/blog/[slug]` без Cache-Control/rate-limit     |
| BL3 | 🟠 MED   | `coverImage` без `isSafeUrl()` — JS/data/SSRF можливе                   |
| BL4 | 🟡 MED   | Blog category create без RESERVED_SLUG check (можна `blog/admin`)       |
| BL5 | 🟡 MED   | Audit-log на publish/unpublish без before/after                         |
| BL6 | 🟢 LOW   | Comments GET без paging — повертає до 200 за один раз                   |
