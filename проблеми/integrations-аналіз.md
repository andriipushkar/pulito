# Аналіз розділу «Інтеграції» (`/admin/integrations`)

> Дата: 2026-05-26
> Сфера: `admin/integrations/page.tsx` (267), `services/integration-credentials.ts` (53), `services/integration-1c.ts` (355), `api/v1/admin/integration/api-keys/*`, `api/v1/integration/1c/*`, `middleware/api-key-auth.ts`, `lib/encryption.ts`.
> Контекст: pulito.trade — UA B2B; 1C/BAS — стандартна ERP; CASTRA-audits вимагають exact kopiyky.

---

## Знахідки за severity

| #      | Тема                                                                                                                                                                                                      | Файл / рядок                                       | Severity                |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------- |
| **I1** | **No 1C credential encryption layer** — у `integration-credentials.ts` немає `get1CCreds()`, на відміну від payment providers (LiqPay/Mono/WayForPay). Якщо 1C secrets десь зберігаються — вони plaintext | `services/integration-credentials.ts:1-54`         | 🔴 HIGH                 |
| **I2** | **No `__confirmClearSensitive` guard** на API keys mutation — порожні permissions silently зберігаються, integration може зламатися без явного попередження                                               | `api/v1/admin/integration/api-keys/route.ts:14-51` | 🔴 HIGH                 |
| **I3** | **Deactivate API key без confirmation** — один клік → integration breaks до наступного sync failure                                                                                                       | `admin/integrations/page.tsx:93-101`               | 🔴 HIGH (UX-катастрофа) |
| **I4** | **Float для prices у 1C валідаторі** — kopiyky губляться через JS float, не Decimal. CASTRA-audits спіймають                                                                                              | `validators/integration-1c.ts:50-53`               | 🔴 HIGH                 |
| **I5** | **Sync + credential rotation race** — admin deactivates key поки cron виконує sync → sync застряг у `running` назавжди                                                                                    | `api/v1/integration/1c/prices/route.ts:19-40`      | 🟠 HIGH                 |
| **I6** | **No HMAC-signing на inbound 1C webhooks** — API-key auth, але без signature на payload. 1C сервер спуфабельний через IP swap                                                                             | `api/v1/integration/1c/*.ts`                       | 🟠 MED-HIGH             |
| **I7** | **No rate-limit на 1C endpoints** — admin'ський key може hammer'ити /prices /stock → DB locks, cache thrashing                                                                                            | `api/v1/integration/1c/stock/route.ts:9+`          | 🟠 MED                  |
| **I8** | **Stuck-job protection відсутній** — `integrationSync` row з `status:running` лишається назавжди при crash                                                                                                | `integration/1c/prices/route.ts:24`                | 🟠 MED                  |
| **I9** | **Audit log містить full permissions JSON + key prefix** — searchable, prefix leak патерн (`csk_`)                                                                                                        | `api-keys/route.ts:71`                             | 🟡 MED                  |
| I10    | `lastUsedAt` fire-and-forget без await — stale                                                                                                                                                            | `middleware/api-key-auth.ts:74-79`                 | 🟢 LOW                  |
| I11    | Non-idempotent 1C re-sync — duplicate `updated:100` show twice                                                                                                                                            | `integration-1c.ts:303-355`                        | 🟢 LOW                  |
| I12    | No aggregated "Last sync of type X" — admin не бачить, що sync 5 днів тому впав                                                                                                                           | `integrations/page.tsx`                            | 🟢 LOW                  |
| I13    | `errorLog` не показується у UI — silent failure                                                                                                                                                           | `integrations/page.tsx:247-251`                    | 🟢 LOW                  |
| I14    | 1C endpoints завжди 200 навіть на повний fail — admin думає що ОК                                                                                                                                         | `integration/1c/products/route.ts:44-48`           | 🟡 MED UX               |
| I15    | `Decimal` ↔ JS float у `priceRetail` send                                                                                                                                                                 | `integration-1c.ts:166`                            | 🟢 LOW                  |
| I16    | `csk_` prefix predictable (small space leak, безпечно загалом)                                                                                                                                            | `api-key-auth.ts:95`                               | 🟢 LOW                  |
| I17    | Copy-key без feedback toast                                                                                                                                                                               | `integrations/page.tsx:125-133`                    | 🟢 LOW                  |
| I18    | Masked key suffix занадто короткий                                                                                                                                                                        | `integrations/page.tsx:173-174`                    | 🟢 LOW                  |

---

## 🎯 ТОП-7 пріоритетних правок

| #   | Що                                                                                                                          | Severity    |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | **I3** — Confirm dialog для deactivate API key (показ ім'я + warning «integration breaks»).                                 | 🔴 HIGH     |
| 2   | **I8** — Cron, який маркує stuck-running syncs старші за 2h як failed                                                       | 🟠 HIGH     |
| 3   | **I7** — Rate-limit на 1C endpoints через API key (RATE_LIMITS.api1c)                                                       | 🟠 MED-HIGH |
| 4   | **I13** — UI: клік на failed-badge відкриває errorLog modal                                                                 | 🟡 MED UX   |
| 5   | **I14** — 1C sync endpoints повертають 500 при повному fail (не 200)                                                        | 🟡 MED      |
| 6   | **I1** — Додати `get1CCreds()` у `integration-credentials.ts` (декларація + encrypted storage для майбутніх 1C connections) | 🔴 HIGH     |
| 7   | **I9** — Audit log без key prefix; зберігати лише keyId/keyName                                                             | 🟡 MED      |

## Решта (low-priority)

- ✅ **I2** (empty permissions guard) — 2026-05-29: POST `/integration/api-keys` тепер 422 якщо всі дозволи `false` (марний ключ → 403 на кожен 1C-виклик, integration silently breaks)
- I4 (decimal в валідаторі) — `z.coerce.number()` → keep but document; full Decimal — окрема міграція (Variant C)
- I5 (sync+rotation race) — advisory lock per key (помірна складність, відкладено)
- I6 (HMAC на 1C webhooks) — required only якщо 1C активно інтегровано — відкладено
- I10 — `lastUsedAt` fire-and-forget **навмисний** (await сповільнив би кожен API-виклик) — skip
- I11/I12, I15-I18 — UX polish / cosmetic; I16 «безпечно загалом»; I18 (показ suffix) погіршив би безпеку — skip

> Re-audit 2026-05-29: I4/I15 = Variant C (decimal); I5/I6 відкладені by-design; решта — низькоцінний UX. Виправлено I2.
