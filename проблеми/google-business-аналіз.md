# «Google-business» (Google Places API integration) — ТОП-2

| #   | Severity | Що                                                                                                                                         |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| GB1 | 🟡 MED   | GET з `?force=1` обходить кеш і фьорсить external Google Places API call — кожен виклик коштує. Stuck UI або hijack session — drain budget |
| GB2 | 🟢 LOW   | GET без `Cache-Control` header для cached відповіді (HTTP-layer cache could amplify Redis)                                                 |
