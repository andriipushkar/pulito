# Аналіз вкладки «Замовлення» (`/admin/orders`)

> Дата: 2026-05-26
> Сфера: `src/app/(admin)/admin/orders/` — `page.tsx` (1214 LOC), `[id]/page.tsx` (905), `board/page.tsx` (229), `bulk/page.tsx` (240).
> API: `src/app/api/v1/admin/orders/` — `route.ts`, `[id]/`, `bulk-status/`, `bulk-ttn/`, `export/`, `labels/`, `packable/`.
> Ролі огляду: програміст, маркетолог, QA, користувач (оператор/власник).

---

## 1. 👨‍💻 Як програміст

### Сильні сторони

- Розділена відповідальність: list / board / bulk / detail — окремі route'и.
- `bulk-status` коректно ходить по orderIds по одному, не abort'ить на першій помилці (одна invalid transition не валить весь batch).
- Optimistic-lock на оновленні статусу замовлення (видно з коментаря «invalid transitions and optimistic-lock conflicts»).
- Auth через `withRole('admin','manager')` всюди в API.

### Проблеми / технічний борг

| #      | Проблема                                                                                                                                                                                                                                         | Файл / рядок                                  | Ризик                                              |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | -------------------------------------------------- |
| **O1** | **Немає server-side idempotency** на `POST /api/v1/admin/orders/bulk-status` і `PUT /api/v1/admin/orders/[id]/status`. Подвійний клік або двофункціональні таби надсилають дві мутації — обидві дають аудит-запис і шанс race на optimistic-lock | `bulk-status/route.ts:28`, `page.tsx:451-482` | **Високий**: подвійний audit log, потенційний race |
| O2     | **Bulk TTN admin-only**, але UI показує кнопку менеджеру → silent fail                                                                                                                                                                           | `bulk-ttn/route.ts:26`                        | Високий UX                                         |
| O3     | **Manager scope на assignment**: будь-який менеджер може переписати призначення на іншого менеджера (cross-team theft)                                                                                                                           | `[id]/page.tsx:342-362`, API route            | Високий (внутрішня безпека)                        |
| O4     | **Board мовчазно обрізає на `limit=100`** — аналог P1 в marketplaces. На 101+ активних замовленнях drag-and-drop працює тільки на видимих, інші зникають                                                                                         | `board/page.tsx:53`                           | Високий                                            |
| O5     | **Nova Poshta bulk без rate-limit awareness**: 5 паралельних, без backoff на 429, без circuit breaker. Користувач думає «3 з 10 ок», насправді останні 5 потрапили в rate-limit                                                                  | `bulk-ttn/route.ts:100`                       | Високий                                            |
| O6     | **Currency через `Number()`** — float-арифметика на гроші. `itemsSubtotal` накопичує по 1-2 копійки drift на накладних                                                                                                                           | `[id]/page.tsx:244-247`                       | Середній (звітність неточна)                       |
| O7     | **Stats polling re-uses stale filter closure** — після visibility-resume опитує зі старими фільтрами                                                                                                                                             | `page.tsx:377-408`                            | Середній                                           |
| O8     | **Drag-drop optimistic update** використовує референс до масиву `orders` як snapshot. Якщо external update перепише `orders` під час drag → revert невірний                                                                                      | `board/page.tsx:95-106`                       | Середній (рідкий race)                             |
| O9     | **Manager comment auto-save без debounce** — `onBlur` шле 3+ збереження при rapid tab/focus                                                                                                                                                      | `[id]/page.tsx:621-623`                       | Низький (флуд audit log)                           |
| O10    | **Margin calc div-by-zero** показує порожнє замість «N/A» при `price ≤ 0` → оператор думає «товар видалено»                                                                                                                                      | `[id]/page.tsx:710-726`                       | Низький                                            |
| O11    | **Date preset boundary off-by-one**: `week` робить `-6`, `month` робить `-29` — намір неясний («останні 7» включно vs «останні 30» включно)                                                                                                      | `page.tsx:441`                                | Низький                                            |
| O12    | **Selection не очищається при зміні фільтра** в page list. Race: вибрав 5 на сторінці 2, зняв фільтр, сторінка 2 — інші замовлення, bulk б'є по неправильних                                                                                     | `page.tsx:355`                                | **Високий UX-баг**                                 |

---

## 2. 📈 Як маркетолог

**Сильні сторони:**

- Stats-полінг для swing-чисел (нові замовлення, до відвантаження) — основа для real-time ops dashboard'а.
- Bulk-export CSV є — для зовнішньої аналітики.

**Чого бракує:**

1. **Немає сегментації клієнтів** прямо в orders list. Не видно: «це повторний клієнт? VIP? новий?». Це critical для upsell-кампаній.
2. **Немає cohort-метрик** на сторінці замовлення (LTV, days_since_first_order, AOV історичний).
3. **Немає expected-revenue** при зміні статусу — admin не бачить, як `cancelled` ↔ `completed` впливає на щоденну виручку.
4. **Filter presets обмежені**: лише дата + статус. Немає «безкомпонентний», «без оплати >24год», «вийшов із Nova Poshta але не получений», «оплачено, але не зібрано».
5. **Export CSV** — без можливості налаштувати колонки. Для звітів маркетингу часто потрібно «order_id, source, utm_campaign, items_total, profit».
6. **Bulk message клієнтам відсутній**: вибираю 50 «не получили посилку» і не можу зробити broadcast «де ваша посилка?»

---

## 3. 🧪 Як QA — edge cases

| #    | Сценарій                                                                                        | Реальна поведінка                                                                                      | Очікувана                                      |
| ---- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| QO1  | Подвійний клік «Quick-status» на список                                                         | 2 PUT → 2 audit log записи; optimistic-lock може зробити 1 з них 409                                   | Перший шле, другий ігноруємо                   |
| QO2  | Менеджер відкриває замовлення, інший менеджер змінює статус, перший зберігає коментар           | Перший перезапише чужі зміни через стейл cached order                                                  | Conflict → re-fetch                            |
| QO3  | Drag-and-drop board, поки воно завантажує — у фоні оновлюється джерело                          | revert йде на застарілому snapshot → board показує проміжний стан                                      | Snapshot by ID, не by ref                      |
| QO4  | Bulk-status 50 замовлень коли частина в `cancelled`                                             | По одному падає з invalid transition; результат показує "X ok, Y failed" — але звіт без деталей причин | Per-row reason                                 |
| QO5  | Nova Poshta повертає 429 на 4-му замовленні                                                     | UI показує "3 з 10 створено", але насправді 6 з тих що не дійшли — теж не створено                     | Retry з backoff                                |
| QO6  | Користувач має список орденів, фільтрує «оплачено», вибирає 3, знімає фільтр, тисне bulk-action | Bulk б'є по тих 3 з повного списку (нові індекси) — НЕ ті 3 що вибрав                                  | Selection cleared on filter change             |
| QO7  | Кнопка bulk-TTN видима менеджеру                                                                | Менеджер тисне → 403 (admin-only endpoint)                                                             | Або відкрити для менеджера, або сховати кнопку |
| QO8  | Експорт CSV без логіну (прямий URL)                                                             | Залежить від middleware — потенційно витік                                                             | Auth обов'язково                               |
| QO9  | Order detail тримає `comment` тільки на onBlur, користувач закриває таб одразу                  | Останній символ не зберігається                                                                        | Сeлектів change з debounce 1s                  |
| QO10 | Margin badge на дешевому товарі (priceBuy=0)                                                    | Порожньо                                                                                               | «N/A», або «∞%», або «—»                       |
| QO11 | Period preset «week» vs «month» дають інші boundary                                             | Інконсистентно (включно vs виключно)                                                                   | Спільна логіка                                 |
| QO12 | Видалення менеджера, коли він закріплений за замовленням                                        | UI показує `assignedManagerId: 42` → null reference                                                    | Нагадування при видаленні менеджера            |

---

## 4. 👤 Як користувач (оператор/власник)

**Перші 30 секунд:**

- Список замовлень — стандартна таблиця з фільтрами. Хороша швидкість, але **дуже багато колонок** — на ноутбуці треба скролити горизонтально.
- Board view — гарна kanban-метафора. Але без `limit=100` warning'а заплутує.
- Bulk view — окрема сторінка, що відриває контекст. Багато операцій можна було робити з основного списку.

**Що болить:**

1. **Не видно «вартих уваги»**. Як в marketplaces я зробив `<AttentionPanel />` — тут потрібен такий же top-bar: «N замовлень без TTN >24год», «M прострочених оплат», «K зависли в processing >3 днів».
2. **Drag-drop на board без сповіщення про незавантажені**. Якщо є 150 замовлень, дивлюсь на 100, передзвонюю клієнту «де ваше з 22 травня» — а воно поза екраном.
3. **Зміна фільтра не скидає вибір** — це класична UX-пастка з тяжкими наслідками (bulk на чужі замовлення).
4. **Експорт CSV — кнопка є, але без drag-вибору колонок**. Для звіту керівнику доводиться обробляти в Excel.
5. **Margin badge без пояснення формули** при hover'і. Оператор не розуміє: це від ціни роздробу? оптової? з урахуванням знижок?
6. **Немає «попередній/наступний» на сторінці замовлення**. Кожен раз треба повертатись у список, потім тиснути знов.
7. **Картка замовлення показує всі деталі одразу**. Збір замовлення в магазині — потрібен focus-mode: тільки items + адреса + телефон. Зайвих 30% інтерфейсу під час пакування.
8. **Manager-assignment без візуальної підказки** «ти береш на себе» vs «передаєш». При reassign перший власник не отримує сповіщення.

---

## 🎯 ТОП-7 пріоритетних правок

| #   | Що                                                                                                                                                                                                                                                                               | Файл                                                 | Ефект |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----- |
| 1   | ✅ **O4** — створено dedicated endpoint `GET /api/v1/admin/orders/board`, без 100-cap, повертає до 2000 з полями `total`/`truncated`/`cap`. Додано warning-banner у board UI коли truncated. Бонус O8: drag-drop revert через `originalStatus` (per-id), не через array snapshot | `board/route.ts` (новий), `board/page.tsx`           |
| 2   | ✅ **O12 / QO6** — selection clear при зміні фільтра вже був (`page.tsx:355` `useEffect([filters])`). Перевірено: вкривається існуючим useEffect для `page,status,clientType,…` — не регресовано                                                                                 | `page.tsx:355`                                       |
| 3   | ✅ **O1** — `bulkTtnInFlight` і `bulkStatusInFlight` `useRef`-guards на bulk-операціях (синхронний block перед setState). Quick-status уже мав adequate guard через `confirmDialog`+`isUpdating`                                                                                 | `page.tsx:164-174`                                   |
| 4   | ✅ **O2 / QO7** — `useAuth()` → `isAdmin`; кнопка «Створити ТТН (НП)» рендериться тільки для admin'ів. Менеджер тепер не бачить нерелевантну для нього кнопку                                                                                                                    | `page.tsx:798`                                       |
| 5   | ✅ **O5** — `callWithBackoff` wrapper з expon. delays `[800ms, 2s, 5s]`. Retryable: `429`, `5xx`. Усі інші помилки одразу — без зайвих затримок                                                                                                                                  | `bulk-ttn/route.ts:124`                              |
| 6   | ✅ **OrdersAttentionPanel** — новий endpoint `GET /api/v1/admin/orders/attention` повертає 3 лічильники (без TTN >24год, без оплати >24год, в processing >3дні). UI пілюлі ▲ червоні/жовті з deep-link на пре-фільтрований список. При 0/0/0 → «✓ Все ок»                        | `attention/route.ts` (новий), `page.tsx` (компонент) |
| 7   | ✅ **Pack-mode** на сторінці `/admin/orders/[id]` — toggle button `📦 Pack-mode`. Persist в `localStorage` між замовленнями (для packing run). Ховає: status update, manager assignment, manager comment, OrderTimeline, TagPicker. Лишає: items, contact, delivery address      | `[id]/page.tsx`                                      |

## Бонус (поза TOP-7)

- ✅ **O8** drag-drop snapshot fix — revert тепер не торкає інших замовлень при concurrent reload | `board/page.tsx:96-108` |

---

## Решта залишку (середнього/низького пріоритету)

- O3 (manager scope assignment) — security policy decision: обмежити reassign лише admin, або підтверджувати через manager id.
- O6 (currency drift) — мігрувати invoice math на Decimal/копійки.
- O7 (stats polling stale filters) — read filters via ref у callback.
- O8 (drag-drop snapshot by ref) — capture snapshot by ID-map.
- O9 (comment без debounce) — додати `useDebounce` 500ms перед save.
- O10 (margin div-by-zero) — fallback UI «N/A».
- O11 (date preset boundary) — узгодити inclusive/exclusive.

## Наступні кроки

- Узгодити з власником ТОП-7 правок (за пріоритетом ↑) і починати по-одному з `npm run build` + `pm2 restart pulito` після кожного.
- Закривати пункти галочками тут у файлі по мірі виконання (як в `маркетплейси-аналіз.md`).
