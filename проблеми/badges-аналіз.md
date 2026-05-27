# «Badges» (product badges + auto-assign cron) — ТОП-7

| #   | Severity | Що                                                                                                                                                                             |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | --------------------------------------------------------------------------- |
| BD1 | 🔴 HIGH  | Cron `/cron/auto-badges` auth only `APP_SECRET`; нема `CRON_SECRET                                                                                                             |     | APP_SECRET`fallback + нема`withCronLock`— overlapping ticks race на`upsert` |
| BD2 | 🔴 HIGH  | `autoAssignBadges` N+1: `for (...) { await prisma.productBadge.upsert(...) }` × 1000 new products = 1000 sequential DB roundtrips. `createMany skipDuplicates` is what we want |
| BD3 | 🟠 HIGH  | PUT + DELETE на `[id]` без `logAudit` — admin може silently flip `isLocked=true` (immune до cron cleanup) без trail                                                            |
| BD4 | 🟠 MED   | Inline `if (!ALLOWED_BADGE_TYPES.includes...)` валідація POST + PUT — drift-prone, нема Zod                                                                                    |
| BD5 | 🟡 MED   | `customColor` без формату-guard — `body.customColor = '<script>alert(1)'` зберігається; ризик коли UI рендерить `style={{ background: badge.customColor }}`                    |
| BD6 | 🟡 MED   | `customText` без length cap — admin може записати 10MB label                                                                                                                   |
| BD7 | 🟢 LOW   | `autoAssignBadges` cleanup НЕ перевіряє `isActive` бейджа на products що деактивовані — `productBadge` лишається, але badge невидимий; чистка lazy                             |
