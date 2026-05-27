# «Referrals» — ТОП-7

| #   | Severity    | Що                                                                                                      |
| --- | ----------- | ------------------------------------------------------------------------------------------------------- |
| R1  | 🟠 HIGH     | Deleted-user код залишається active — нові реєстрації приписуються «привиду»                            |
| R2  | 🟠 HIGH     | Bonus grant не перевіряє чи referrer `deletedAt`/`isBlocked` — гроші на видалений account               |
| R3  | 🟠 HIGH     | No unique constraint `referredUserId` — race на 2 паралельних реєстрації з різними кодами → 2 referrals |
| R4  | 🟡 MED      | `/me/referral` без specific rate-limit — 100/min дозволяє code enumeration                              |
| R5  | 🟡 MED      | Self-referral анти-fraud (phone/name match) silently skips без metric/log                               |
| R6  | 🟢 LOW      | randomBytes(4) = 8 hex (~4.3B keyspace) — brute-forceable                                               |
| R7  | ✅ Verified | Atomic updateMany на bonus grant; audit-log є; self-id check присутній                                  |
