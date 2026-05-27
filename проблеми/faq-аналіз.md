# «FAQ» (frequently asked questions) — ТОП-5

| #   | Severity | Що                                                                                                                                                |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| FQ1 | 🟠 HIGH  | Public `GET /api/v1/faq` без rate-limit та `Cache-Control` — storefront polling + bot scrape = надмірне DB load (2 queries для grouped + orphans) |
| FQ2 | 🟠 HIGH  | `POST /api/v1/faq/[id]/click` без rate-limit — bot може накрутити `clickCount` одного питання → впливає на rank у `searchFaq`                     |
| FQ3 | 🟡 MED   | `searchFaq` робить `contains` insensitive на `question + answer` без full-text index і без length cap — довгий query = повільний scan             |
| FQ4 | 🟡 MED   | PUT/DELETE: `revalidatePath('/faq')` без try/catch — ISR fail кидає 500 navenpath успішну update                                                  |
| FQ5 | 🟢 LOW   | `searchFaq` query не sanitize control chars / не truncate — corner-case ReDoS-ризик                                                               |
