# «Segments» (customer segmentation + preview + export) — ТОП-6

| #   | Severity | Що                                                                                                                                                                                                             |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SG1 | 🔴 HIGH  | `prisma.user.findMany` у `runSegment` без `deletedAt: null` / `isBlocked: false` — soft-deleted та заблоковані юзери потрапляють у segment → email-кампанія на deleted/blocked customers (CAN-SPAM, GDPR risk) |
| SG2 | 🟠 HIGH  | Preview без `logAudit` — admin може перебирати segments і дивитись на customer counts/spend без сліду. PII masking є, але query history губиться (forensics gap для GDPR)                                      |
| SG3 | 🟠 MED   | Preview без rate-limit. Кожен виклик = `findMany` усіх клієнтів з orders → scaling concern, можна reuse `adminExport` 10/min                                                                                   |
| SG4 | 🟡 MED   | `bodySchema.rules.min(1)` без `max(N)` — admin може передати 1000 правил, eval на кожному user × rules = O(M×N) freeze                                                                                         |
| SG5 | 🟡 MED   | In-memory `segmentCache` не invalidate-иться при user/order mutations — у вузькому 30s вікні preview/export може віддати stale матч                                                                            |
| SG6 | 🟢 LOW   | `compareStr` без Unicode NFC normalize — «Київ» з Latin `i` не зматчиться з Cyrillic                                                                                                                           |
