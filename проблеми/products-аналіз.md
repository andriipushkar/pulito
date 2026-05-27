# Аналіз розділу «Товари» (`/admin/products`)

> Дата: 2026-05-26
> Сфера: `src/app/(admin)/admin/products/` — `page.tsx` (1216 LOC), `[id]/page.tsx` (1458), `new/page.tsx` (617), `duplicates/page.tsx` (176), `image-quality/page.tsx` (197).
> API: `src/app/api/v1/admin/products/` — `route.ts`, `[id]/`, `bulk/`, `duplicates/`, `image-quality/`, `inventory-stats/`, `barcode-pdf/`, `lookup-barcode/`, `ai-generate-preview/`, `labels/`.
> Ролі огляду: програміст, маркетолог, QA, користувач (контент-менеджер).

---

## 1. 👨‍💻 Як програміст

### Сильні сторони

- Розділена відповідальність: list / detail / new / duplicates / image-quality — окремі route'и.
- Bulk endpoint `bulk/route.ts` обгорнуто у `prisma.$transaction` — атомарність на batch (хоч і ціною N round-trip).
- Optimistic concurrency token (`version`) частково присутній на детальному edit.
- Soft-delete tombstone для товарів з FK на orderItems (referential integrity).
- Inline-editing (ціна/кількість/sort) — добра UX, але має конкурентні діри (нижче).

### Проблеми / технічний борг

| #       | Проблема                                                                                                                                                                                               | Файл / рядок                                                   | Ризик                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ------------------------- |
| **PR1** | **AI-generate без spend-limit / rate-limit**. Швидкі кліки → необільованi Claude/Gemini API запити. Може стати фактором "$10k surprise bill"                                                           | `[id]/page.tsx:802`, `/api/v1/admin/products/[id]/ai-generate` | **Високий** (фінансовий)  |
| **PR2** | **Bulk price update — N×update у транзакції** (sequential roundtrips). На 5000 items = довга транзакція з row-locks                                                                                    | `bulk/route.ts:235-239`                                        | Високий (perf + DB locks) |
| **PR3** | **Optimistic-lock без 409-handling**. Token надсилається, але клієнт не реагує на conflict — silent loss of edits                                                                                      | `[id]/page.tsx:338-349`                                        | Високий                   |
| **PR4** | **Inline price commit без version check**. Два менеджери редагують → last-write-wins, без попередження                                                                                                 | `[id]/page.tsx:474-500`, PUT endpoint                          | Високий                   |
| **PR5** | **Bulk-action ідемпотентність**. `change_price` подвійний клік → ціни оновлено двічі (можливо із %-кроком — реальна шкода)                                                                             | `bulk/route.ts:157-260`                                        | **Високий** (гроші)       |
| **PR6** | **Soft-vs-hard delete classification race**. groupBy → update із вікном 10-100ms; нове замовлення між цими кроками → товар, який мав стати soft-delete, hard-delete'ається з FK помилкою (або навпаки) | `bulk/route.ts:72-136`                                         | Середній (рідкий race)    |
| **PR7** | **«Select All» не reset на pagination/filter**. Селект здається "all 20" але selected.size відображає лише першу сторінку — bulk-action на неправильні id                                              | `page.tsx:281-284`                                             | **Високий UX-баг**        |
| **PR8** | **Pending inline-state не очищається при зміні фільтра**. `pendingPrice/Qty/SortOrder` залишаються після switch category                                                                               | `page.tsx:257-263`                                             | Середній UX               |
| **PR9** | **Slug uniqueness — лише client-side warning**. Server `updateProductSchema` без unique check → DB violation замість гарного повідомлення                                                              | `[id]/page.tsx:593,600`, validator                             | Середній                  |
| PR10    | `useOrderListKeyboard` deps: `products.map(...).join(',')` будується кожен рендер                                                                                                                      | `page.tsx:145`                                                 | Низький perf              |
| PR11    | 3 inline-commits (price/qty/sortOrder) для одного рядка = 3 PUT-и замість одного PATCH                                                                                                                 | `page.tsx:474-500`                                             | Низький                   |
| PR12    | Duplicates page без debounce на slider threshold → 10 запитів за секунду                                                                                                                               | `duplicates/page.tsx:37-39`                                    | Низький                   |
| PR13    | `removeBgEnabled` toggle не persisted (втрачається при reopen)                                                                                                                                         | `[id]/page.tsx:549-565`                                        | Низький UX                |
| PR14    | `window.prompt()` для label copies — type-confusion risk, без validation                                                                                                                               | `page.tsx:388-413`                                             | Низький                   |
| PR15    | Reindex без count-confirmation: "проіндексовано 0" виглядає як успіх                                                                                                                                   | `page.tsx:628-634`                                             | Низький UX                |
| PR16    | Triple-cast `(res.data as unknown as { weightGrams })` — typing hack                                                                                                                                   | `[id]/page.tsx:255-273`                                        | Низький (style)           |

---

## 2. 📈 Як маркетолог

**Сильні сторони:**

- Bulk-операції з price/discount/category — основа для seasonal-кампаній.
- AI-генерація опису товарів — economy of scale при додаванні 100+ SKU.
- Duplicate-detector — захищає від канібалізації трафіку.
- Image-quality audit — впливає на конверсію (поганi фото = вихід).

**Чого бракує:**

1. **Немає «conversion gauge» на товарі**: skipped в SEO-audit, але CR/AOV per product не показано в detail page.
2. **Bulk discount без preview** — натиснув "−10% на всі електроніку", не побачив result поки не submit'нув. Маркетолог боїться натискати.
3. **AI-генерація опису без A/B варіантів**. Отримуєш 1 варіант, погоджуєшся або скасовуєш. Хочеш 3 варіанти?
4. **Sort-order поле числове** замість drag-and-drop — на категорійних landing'ах треба перетягувати "позицію в категорії", не вписувати 142.
5. **Немає «hide from search»** окремого toggle. `isActive=false` ховає звідусіль; маркетологу часто треба «лишити для діючих кампаній але прибрати з нового indexing».
6. **AI-generated description без brand-voice consistency check**. Якщо власник написав 50 описів у певному стилі, AI має це засвоїти.
7. **Без SEO-діагностики прямо в товарі**. Поля title/description/h1 є, але без real-time перевірки "цей title не вписується у 60 символів Google snippet".

---

## 3. 🧪 Як QA — edge cases

| #    | Сценарій                                                                | Реальна поведінка                                                                                           | Очікувана                                    |
| ---- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| QP1  | Подвійний клік "Generate AI description"                                | 2 запити, обидва оплачуються                                                                                | Перший шле, другий ігноруємо (in-flight ref) |
| QP2  | Два менеджери відкрили один товар, обидва змінили ціну, обидва зберегли | Останній перезапише першого silently                                                                        | 409 Conflict + re-fetch                      |
| QP3  | Selected 20 на page 1, перейшов на page 2, "Select All" знов            | Selection now points до 40 IDs (20 з page 1 + 20 з page 2) — bulk шле 40                                    | Зрозумілий tally + warning                   |
| QP4  | Bulk price `+10%` подвійний клік                                        | Ціни оновлено двічі (+21% сукупно)                                                                          | Idempotency-key захист                       |
| QP5  | Inline edit price → switch category → switch back                       | Старе pending значення в input                                                                              | Очищене                                      |
| QP6  | Bulk delete 100 товарів, серед яких 30 мають orders                     | groupBy класифікує, у вікно прилітає нове замовлення — race                                                 | Lock products перед classify                 |
| QP7  | Зміна slug на дублікат існуючого                                        | Warning client-side ✓, але PUT повертає DB error «Unique violation on slug» — користувач бачить generic 500 | 422 з конкретним повідомленням               |
| QP8  | AI-generate-preview без grace для empty image set                       | API кидає 500 чи 400? Невідомо без логів                                                                    | Захист на бекенді з 400 + повідомленням      |
| QP9  | Duplicate slider 0% → 100% (швидко)                                     | 10+ паралельних запитів                                                                                     | Debounce 300ms                               |
| QP10 | Image upload 50MB                                                       | Залежить від Next config — або помилка, або silent fail                                                     | Pre-flight check size + MIME                 |
| QP11 | Bulk-discount '−1500%' (мінусова ціна)                                  | DB може прийняти від'ємне число                                                                             | Validator clamp 0..100                       |
| QP12 | Reindex запущено 2 рази одночасно з двох вкладок                        | 2 операції паралельно — навантаження                                                                        | Mutex / 409                                  |
| QP13 | "Hide from search" toggle                                               | Немає такого окремо — лише isActive                                                                         | Окремий toggle                               |
| QP14 | Inline qty change на товарі без stock-tracking                          | Може дозволити від'ємну кількість                                                                           | Schema constraint min:0                      |

---

## 4. 👤 Як користувач (контент-менеджер)

**Перші 30 секунд:**

- Список товарів — стандарт, з фільтрами, sort, bulk. Знайомо.
- Detail page — багато табів і секцій (опис, фото, варіації, маркетплейси, SEO, історія). Іноді важко знайти потрібне поле.
- New product form — 617 LOC одна сторінка, без wizard'а. Перший раз страшно.

**Що болить:**

1. **AI-кнопка близько до Save**. Можна випадково натиснути генерацію коли просто хотів зберегти.
2. **Inline edit без візуального «pending»**. Зміна ціни → натиснув Enter → щось відбулось? Спін відсутній.
3. **Bulk-action на «всі сторінки» vs «лише поточна»** не очевидно. Як в marketplaces, треба явно сказати.
4. **Маркетплейси-вкладка на товарі** — не видно одразу «де опубліковано». Треба переключити кожну, перевірити галочку.
5. **Duplicate detector** показує пари, але без «merge wizard». Треба вручну перенести варіації, потім видалити.
6. **Image-quality звіт** показує "X фото потребують уваги", але без in-place "виправити". Треба переходити в кожен товар окремо.
7. **Reindex** — без прогресу, ні estimated time. 5 хвилин чорний екран.
8. **«Створити схожий» (clone) функція** — є чи нема? Менеджеру щоразу копіювати поля болить.

---

## 🎯 ТОП-7 пріоритетних правок

| #   | Що                                                                                                                                                                                                                                                           | Файл                                                                                     | Ефект |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ----- |
| 1   | ✅ **PR1** — `RATE_LIMITS.adminAiGenerate` (60/год/користувач) на ОБИДВА AI-endpoint'и (`[id]/ai-generate` + `ai-generate-preview`). `aiInFlight` ref-guard на ОБИДВІ AI-кнопки клієнта                                                                      | `rate-limit.ts`, `ai-generate/route.ts`, `ai-generate-preview/route.ts`, `[id]/page.tsx` |
| 2   | ✅ **PR5** — `bulkInFlight` ref-guard на `handleBulkAction` (синхронний block перед setState). Server idempotency-key — окрема задача (потребує Redis store)                                                                                                 | `page.tsx:147`                                                                           |
| 3   | ✅ **PR7** — Bulk bar тепер показує «Обрано X на цій сторінці» + amber warning «з Y загальних — інші сторінки не зачіпаються» коли total > products.length                                                                                                   | `page.tsx:712-728`                                                                       |
| 4   | ✅ **PR4/PR3** — Доданий `version: true` у list-endpoint select, `version?: number` у AdminProduct. Helper `commitInlineField` для price/qty/sortOrder надсилає version і на 409 re-fetch'ить рядок + показує toast «Цей товар було змінено в іншій вкладці» | `route.ts`, `page.tsx:480-557`                                                           |
| 5   | ✅ **PR2** — Bulk price `updateMany` з grouped WHERE: продукти, що дають однакову нову ціну, об'єднуються в один update. Best-case ~10× прискорення, worst-case дорівнює попередній поведінці                                                                | `bulk/route.ts:235-251`                                                                  |
| 6   | ✅ **PR9** — P2002 (Prisma unique violation) у PUT product → 422 з конкретним повідомленням «Цей slug вже використовується» / «Цей артикул/SKU вже використовується» замість generic 500                                                                     | `[id]/route.ts:74-95`                                                                    |
| 7   | ✅ **Bulk preview** — `ConfirmDialog` тепер `whitespace-pre-line` (backwards-compat). Change-price preview показує приклади перших 3 selected товарів з «before → after» + «…та ще N товарів» якщо selected > 3                                              | `ConfirmDialog.tsx`, `page.tsx:1123`                                                     |

## Бонус (з residual списку)

- ✅ **PR8** — `pendingPrice`/`pendingQty`/`pendingSortOrder` тепер очищаються в `updateFilter` — більше не stale draft при switch category | `page.tsx:261-275` |

## Решта (середнього/низького пріоритету)

- PR6 (soft/hard delete race) — захист row-lock перед classify
- PR8 (pending inline-state) — clear in `updateFilter()`
- PR10 (useOrderListKeyboard deps) — useMemo + ref
- PR11 (3 PUT-и на row) — об'єднати в PATCH
- PR12 (duplicates slider) — debounce 300ms
- PR13 (removeBg persist) — localStorage
- PR14 (window.prompt label) — `<input type="number">`
- PR15 (reindex без count) — progress bar
- PR16 (triple-cast) — proper types

## Наступні кроки

- Узгодити з власником: чи робимо batch усього TOP-7 чи стартуємо з PR1 (фінансовий)?
- Після кожної правки: `npm run build` + `pm2 restart pulito`.
- Цей файл оновлюємо ✅ по мірі виконання (як у `маркетплейси-аналіз.md` та `orders-аналіз.md`).
