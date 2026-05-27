# «Subscriptions» (product subscriptions) — ТОП-7

| #   | Severity    | Що                                                                                |
| --- | ----------- | --------------------------------------------------------------------------------- |
| S1  | 🟠 MED-HIGH | Auto-charge від cron без audit-log → неможливо trace для payment-dispute          |
| S2  | 🟠 MED      | Duplicate FREQUENCY_DAYS у 2 файлах — divergence ризик                            |
| S3  | 🟡 MED      | Resume race: customer resume під час cron-claim window → можливий double-fire     |
| S4  | 🟡 MED      | Process-subscriptions cron auth уже на APP_SECRET — потрібно CRON_SECRET fallback |
| S5  | 🟢 LOW      | Resume не лог pausedReason — погана visibility у support                          |
| S6  | 🟢 LOW      | Auto-pause при 2 failed payments — без специфіки якої транзакції                  |
| S7  | ✅ Verified | Cron sentinel-claim коректний (idempotent); cancel ownership-check OK             |
