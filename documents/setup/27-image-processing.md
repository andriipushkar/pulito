# Налаштування обробки зображень

Усі зображення товарів проходять через обробний pipeline (Sharp), який:

1. Валідує формат і розмір
2. Зберігає оригінал (R2 cloud або локально)
3. Генерує 4 варіанти (full / medium / thumbnail / blur) з padding до квадрата
4. Накладає watermark
5. Опційно — видаляє фон через remove.bg API

## Дозволені формати і розміри

| Параметр                  | Значення                                | Де змінити                                  |
| ------------------------- | --------------------------------------- | ------------------------------------------- |
| Дозволені MIME-типи       | `image/jpeg`, `image/png`, `image/webp` | `src/services/image.ts` (`ALLOWED_FORMATS`) |
| Максимальний розмір файлу | **5 МБ**                                | `src/services/image.ts` (`MAX_FILE_SIZE`)   |
| Мінімальний розмір (W×H)  | **300×300 px**                          | `src/services/image.ts` (`MIN_DIMENSION`)   |

Файли інших форматів (HEIC, AVIF, BMP, GIF, SVG) **відхиляються**. Файли менше за `MIN_DIMENSION` дають помилку "Мінімальний розмір фото: 300×300 px".

> Magic-byte валідація через `validateFileType` запобігає підміні розширення (хтось перейменував `.exe` на `.jpg`).

## Згенеровані варіанти

При завантаженні Sharp генерує **4 варіанти** (всі WebP, всі точно квадратні):

| Варіант   | Розмір (px) | Якість | Watermark | Використання                         |
| --------- | ----------- | ------ | --------- | ------------------------------------ |
| full      | 800×800     | 80     | ✅        | Сторінка товару, галерея             |
| medium    | 400×400     | 80     | ✅        | Картки в каталозі, кошик             |
| thumbnail | 150×150     | 80     | ❌        | Мініатюри в адмінці                  |
| blur      | 20×20       | 20     | ❌        | LQIP placeholder перед завантаженням |

Розміри захардкоджені у `src/services/image.ts` (`SIZES`).

## Padding до квадрата (fit: 'contain')

Sharp використовує `fit: 'contain'` з фоновим кольором `#f5f5f5` (`PAD_BACKGROUND`). Це означає:

- Будь-яке некадратне фото отримує padding смугами кольору `#f5f5f5` зверху/знизу або ліворуч/праворуч
- **Усі варіанти у БД є справжніми квадратами** (800×800, 400×400, 150×150, 20×20)
- На сайті фото рендериться без видимих "сірих рамок", бо контейнер картки використовує той самий `#f5f5f5` фон

### Чому саме `#f5f5f5`?

Це значення CSS-змінної `--color-bg-secondary` у світлій темі (`src/app/globals.css`). На темній темі контейнер `#1e293b`, але padding фото лишається `#f5f5f5` — фото тоді виглядає як світлий квадрат на темному тлі (стандартна поведінка більшості e-commerce).

### Зміна padding-кольору

Якщо твій сайт має інший фон карток — постав інший колір:

```ts
// src/services/image.ts
const PAD_BACKGROUND = { r: 245, g: 245, b: 245, alpha: 1 };
//                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                       зміни ці значення RGB
```

Після зміни перегенеруй **всі існуючі** фото (див. секцію регенерації нижче).

### Рекомендація для фотосесії

Фото на нейтрально-сірому фоні `#f5f5f5` (Pantone Pearl Grey) виглядають максимально природно на сайті. PNG з прозорим фоном теж працює — Sharp композитно накладе на `#f5f5f5`.

## Watermark

Накладається на `full` і `medium` варіанти (на `thumbnail` і `blur` — ні).

| Змінна (env)        | За замовчуванням | Опис                          |
| ------------------- | ---------------- | ----------------------------- |
| `WATERMARK_ENABLED` | `true`           | `false` — повністю вимкнути   |
| `WATERMARK_TEXT`    | `pulito.trade`   | Текст у нижньому правому куті |

Колір — напівпрозорий білий (`rgba(255,255,255,0.5)`), розмір шрифту масштабується до 3.5% від ширини варіанта. Шрифт — Arial, bold.

Зміна позиції / прозорості / шрифту — у `src/services/image.ts` (SVG-overlay).

## Cloud storage (Cloudflare R2)

Якщо налаштовано — оригінали і всі варіанти зберігаються у R2 bucket. Інакше — у локальну директорію `${UPLOAD_DIR}/products/<product_code>/`.

| Змінна                 | Опис                                                    |
| ---------------------- | ------------------------------------------------------- |
| `R2_ACCOUNT_ID`        | ID Cloudflare акаунту                                   |
| `R2_ACCESS_KEY_ID`     | Access Key (S3-compatible)                              |
| `R2_SECRET_ACCESS_KEY` | Secret Key                                              |
| `R2_BUCKET`            | Назва bucket (наприклад `clean-products`)               |
| `R2_PUBLIC_URL`        | Public CDN URL (наприклад `https://media.pulito.trade`) |

Якщо `R2_PUBLIC_URL` задано — БД зберігає повні URL'и (`https://media.pulito.trade/products/...`). Інакше — відносні шляхи (`/uploads/products/...`).

Налаштування Cloudflare див. `documents/setup/cloudflare/`.

## Background removal (опційно)

Автоматичне видалення фону через remove.bg API. Опціональна фіча — без `REMOVEBG_API_KEY` чекбокс просто прихований у адмінці.

Повний гайд: [26-background-removal.md](26-background-removal.md).

## Регенерація варіантів існуючих фото

Якщо змінив параметри обробки (PAD_BACKGROUND, watermark text/прозорість, розміри SIZES, або взагалі pipeline) — для **існуючих** фото в БД варіанти лишаються старими. Для перегенерації:

```bash
# Dry-run — показує скільки фото знайдено, нічого не пише
npx tsx scripts/regenerate-product-images.ts --dry-run

# Реальний прогон по всіх товарах
npx tsx scripts/regenerate-product-images.ts

# Тільки для одного товару
npx tsx scripts/regenerate-product-images.ts --product 42
```

### Що робить скрипт

1. Перебирає всі рядки `ProductImage` у БД (батчами по 25)
2. Для кожного — читає **оригінал** через storage abstraction (R2 або локальний FS)
3. Генерує заново 4 варіанти з поточною логікою
4. Перезаписує існуючі файли по тих самих storage-ключах (URL не змінюються)
5. Логує прогрес кожні 10 фото + підсумок (processed / skipped / errors)

### Час

| Storage      | Час на 1 фото | 100 фото | 1000 фото |
| ------------ | ------------- | -------- | --------- |
| Локальний FS | ~200 ms       | ~20 с    | ~3-4 хв   |
| R2 cloud     | ~500-700 ms   | ~50 с    | ~10-15 хв |

### Безпечність

- Оригінали не чіпаємо — `pathOriginal` лишається. Якщо щось піде не так, можна перезапустити скрипт ще раз.
- Помилкові фото (зниклий оригінал, пошкоджений файл) логуються і пропускаються.
- Скрипт ідемпотентний — повторний запуск не ламає вже-перегенеровані файли.

### Кеш CDN

Якщо використовуєш Cloudflare R2 з custom domain і `Cache-Control: immutable` — після регенерації CDN може віддавати кешовану стару версію кілька годин. Краще **purge cache** в Cloudflare кабінеті після завершення скрипта.

## Multi-file upload (виправлений баг)

`<input type="file" multiple>` дозволяє вибрати декілька фото за раз. Раніше route `/api/v1/admin/products/[id]/images` обробляв лише **перший** файл (використовував `formData.get('images')` замість `getAll`). Виправлено.

Тепер route:

- Обробляє файли **послідовно** (не паралельно — щоб не перевантажити CPU/remove.bg rate-limit)
- При помилці одного файлу — інші продовжують
- Повертає `{ ok: [...], failed: [...] }` з причинами

### Ліміти

- Next.js API timeout = **60 секунд**. З BG removal це ~15 фото за раз; без — до 30+.
- Кожен файл ≤5 МБ. iPhone Pro дає 10-12 МБ — стискай перед upload (наприклад, [tinypng.com](https://tinypng.com)).

## Файли модуля

- `src/services/image.ts` — основна логіка обробки
- `src/services/background-removal.ts` — remove.bg API integration
- `src/lib/storage.ts` — abstraction для R2/local
- `src/utils/file-validation.ts` — magic-byte перевірка
- `src/app/api/v1/admin/products/[id]/images/route.ts` — endpoint завантаження
- `src/app/api/v1/admin/products/[id]/images/[imageId]/route.ts` — endpoint видалення
- `src/app/api/v1/admin/upload/capabilities/route.ts` — capability discovery (для UI)
- `scripts/regenerate-product-images.ts` — масова регенерація варіантів
