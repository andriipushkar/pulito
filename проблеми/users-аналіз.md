# Аналіз «Users» (`/admin/users`) — CRM + персонал

## ТОП-7

| #   | Що                                                                                              | Severity    |
| --- | ----------------------------------------------------------------------------------------------- | ----------- |
| U1  | **Last admin protection відсутня** — видалення останнього admin = locked-out система            | 🔴 HIGH     |
| U2  | **Role escalation**: будь-який admin може промувати manager→admin без approval flow             | 🔴 HIGH     |
| U3  | **Manager бачить customer PII** (email/phone/edrpou) в list                                     | 🟠 HIGH     |
| U4  | **Impersonate без rate-limit** — brute-force user enumeration через failed impersonation errors | 🟠 HIGH     |
| U5  | **Self-demotion / self-delete guard** — admin може демоутитися сам себе                         | 🟠 MED-HIGH |
| U6  | **limit cap на list** — `?limit=999999` → bulk PII extraction                                   | 🟡 MED      |
| U7  | **Frontend impersonate без confirm** — випадковий клік переключає сесію                         | 🟡 MED UX   |
| U8  | Temp password 8 chars (weak entropy)                                                            | 🟢 LOW      |
| U9  | Bulk approve без atomic rollback                                                                | 🟢 LOW      |
| U10 | Email uniqueness race на registration                                                           | 🟢 LOW      |

## Re-audit 2026-05-28 (U11–U14)

Перевірка коду показала: попередні HIGH **уже виправлені** в минулих сесіях —
last-admin protection + self-demotion guard у `updateUserRole`; impersonate rate-limit (`sensitive` 3/15хв);
`MAX_LIMIT=100` на list; PII-маскування для `manager`; admin не видаляється (`deleteUserAccount`).
Свіжий re-audit виявив залишковий пробіл саме у **block** (U1/U5 його не покривали).

| #   | Що                                                                                                   | Severity | Статус                                                        |
| --- | ---------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------- |
| U11 | `toggleBlockUser` без guard → адмін блокує **сам себе** (видаляє свої refresh-токени) → self-lockout | 🟠 MED   | ✅ guard «не можна блокувати адміна» (покриває self)          |
| U12 | `toggleBlockUser` → можна заблокувати **останнього/будь-якого адміна** → повний lockout системи      | 🟠 MED   | ✅ той самий guard, консистентно з `deleteUserAccount`        |
| U13 | `updateUserProfile` без валідації формату email, хоча email = логін-ідентифікатор (типо ламає вхід)  | 🟢 LOW   | ✅ regex-перевірка перед uniqueness                           |
| U14 | wholesale-роут нібито не валідує групу перед викликом                                                | —        | ❌ FALSE — `approveWholesale` валідує групу 1–3 (user.ts:929) |

> Пропущено: `editProfile` зміна email не скидає `emailVerified` (admin-initiated, low); temp-пароль 8 hex /
> 32 біти (одноразовий, передається вручну, сесії інвалідуються) — обидва 🟢 LOW, цінність фіксу низька.

> Фікс U11+U12: один guard у `toggleBlockUser` — `if (block && user.role === 'admin')` — покриває self-block
> (себе = адмін), peer-admin і last-admin. Для локауту скомпрометованого адміна лишаються знижання ролі та
> `resetUserPassword` (ротація пароля + інвалідація сесій).
