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
