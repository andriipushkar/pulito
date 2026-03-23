# Модуль каталогу

## Огляд

Каталог складається з деревоподібних категорій та товарів з повнотекстовим пошуком, фільтрацією, бейджами, SEO-шаблонами та кешуванням через Redis.

## Категорії

### Структура
Категорії організовані в дерево через само-зв'язок `parentId`:
- Кореневі категорії: `parentId = null`
- Підкатегорії: `parentId = <id батьківської>`
- Slug-based routing: `/catalog?category=<slug>`

### Публічні ендпоінти

**Список категорій:**
`GET /api/v1/categories`
- Повертає деревоподібну структуру
- Фільтр `isVisible = true`
- Сортування за `sortOrder`

**Категорія за slug:**
`GET /api/v1/categories/:slug`
- Повертає категорію з підкатегоріями та SEO-даними

### Адмін ендпоінти

- `GET /api/v1/admin/categories` -- список всіх (включно з прихованими)
- `POST /api/v1/admin/categories` -- створення
- `PUT /api/v1/admin/categories/:id` -- оновлення
- `DELETE /api/v1/admin/categories/:id` -- видалення

### Валідація (categorySchema)
- `name` -- обов'язково
- `slug` -- автогенерація або ручний
- `parentId` -- опціонально
- `description`, `seoTitle`, `seoDescription` -- опціонально
- `isVisible`, `sortOrder` -- опціонально

## Товари

### Повнотекстовий пошук

Трирівнева система ранжування (`fullTextSearchProductIds`):

1. **Точний збіг коду** (вага 100) -- `code ILIKE %query%`
2. **tsvector пошук** (вага 10) -- `search_vector @@ plainto_tsquery('simple', query)` з `ts_rank_cd`
3. **Trigram similarity** (вага 5) -- `similarity(name, query) > 0.2` (розширення `pg_trgm`)

Додаткове сортування за `orders_count DESC` (популярність).

### Фільтрація

**Endpoint:** `GET /api/v1/products`

| Параметр | Тип | Опис |
|----------|-----|------|
| `page` | number | Сторінка (за замовчуванням 1) |
| `limit` | number | Кількість (за замовчуванням 20, макс 100) |
| `category` | string | Slug категорії |
| `search` | string | Пошуковий запит (мін 2 символи) |
| `priceMin` | number | Мінімальна ціна |
| `priceMax` | number | Максимальна ціна |
| `promo` | boolean | Тільки акційні |
| `inStock` | boolean | Тільки в наявності |
| `sort` | string | Сортування |

### Сортування

| Значення | Опис |
|----------|------|
| `popular` | За популярністю (ordersCount + viewsCount) -- за замовчуванням |
| `price_asc` | Ціна за зростанням |
| `price_desc` | Ціна за спаданням |
| `name_asc` | За назвою |
| `newest` | Новинки (createdAt DESC) |

### Спеціальні вибірки

- `GET /api/v1/products/promo` -- акційні товари
- `GET /api/v1/products/new` -- новинки
- `GET /api/v1/products/popular` -- популярні
- `GET /api/v1/products/search?q=<query>` -- автокомплект (5 товарів + 3 категорії)

### Деталі товару

`GET /api/v1/products/:slug`

Повертає:
- Основні дані (ціни, наявність, промо)
- Контент (опис, характеристики, інструкції, відео)
- Зображення (всі розміри, з головним на першому місці)
- Бейджі (активні, відсортовані за пріоритетом)
- Категорію з SEO-даними
- Персональну ціну (якщо авторизований)

Автоматичне збільшення `viewsCount` (асинхронно).

### Персональні ціни

Для авторизованих користувачів перевіряються `PersonalPrice`:
1. Фіксована ціна (`fixedPrice`) -- пріоритет
2. Знижка відсотком (`discountPercent`) -- від роздрібної ціни

Може бути прив'язана до конкретного товару або цілої категорії.

### Кешування

Використовується Redis-кешування:
- `products:list:<filters>` -- список товарів (MEDIUM TTL)
- `products:slug:<slug>` -- деталі товару (LONG TTL)
- `products:autocomplete:<query>` -- автокомплект (SHORT TTL)
- Інвалідація `products:*` при створенні/оновленні/видаленні

## Бейджі товарів

### Типи бейджів

| Тип | Опис |
|-----|------|
| `promo` | Акційний товар |
| `new_arrival` | Новинка |
| `hit` | Хіт продажів |
| `eco` | Екологічний |
| `custom` | Кастомний (з текстом та кольором) |

Бейджі мають пріоритет (`priority`) та можуть бути активними/неактивними.

## Рекомендації товарів

Типи рекомендацій:
- `bought_together` -- купують разом
- `similar` -- схожі товари
- `manual` -- ручний вибір менеджером

Зберігаються в `ProductRecommendation` з оцінкою `score`.

## Зображення товарів

Кожне зображення має кілька розмірів:
- `pathOriginal` -- оригінал
- `pathFull` -- повний розмір
- `pathMedium` -- середній (для карток)
- `pathThumbnail` -- мініатюра
- `pathBlur` -- розмитий placeholder (для lazy loading)

Метадані: формат, розмір, ширина, висота, alt-текст.

## Адмін-панель товарів

### CRUD
- `GET /api/v1/admin/products` -- список з пагінацією
- `POST /api/v1/admin/products` -- створення (автогенерація slug)
- `PUT /api/v1/admin/products/:id` -- оновлення (з записом у PriceHistory)
- `DELETE /api/v1/admin/products/:id` -- м'яке видалення (isActive = false)

### Зображення
- `POST /api/v1/admin/products/:id/images` -- завантаження
- `DELETE /api/v1/admin/products/:id/images/:imageId` -- видалення

### Імпорт
- `POST /api/v1/admin/import/products` -- масовий імпорт з файлу
- `GET /api/v1/admin/import/logs` -- журнал імпортів
- `GET /api/v1/admin/import/logs/:id` -- деталі імпорту

## SEO-шаблони

Модель `SeoTemplate` дозволяє автоматично генерувати meta-теги:
- `entityType` -- `product` або `category`
- `scope` -- `global` або `category`
- `titleTemplate` / `descriptionTemplate` -- шаблони з placeholder-ами
- `altTemplate` -- для alt-текстів зображень

Приклад: `{product_name} - купити в Clean Shop | {category_name}`

## Історія цін

При зміні ціни автоматично створюється запис в `PriceHistory`:
- Старі та нові ціни (роздріб/опт)
- Дата зміни
- ID імпорту (якщо зміна через імпорт)

## Файли модуля

- `src/services/product.ts` -- CRUD, пошук, фільтрація, кешування
- `src/services/category.ts` -- CRUD категорій
- `src/services/image.ts` -- обробка зображень
- `src/services/badge.ts` -- управління бейджами
- `src/services/recommendation.ts` -- рекомендації
- `src/services/seo-template.ts` -- SEO-шаблони
- `src/services/cache.ts` -- Redis-кешування
- `src/validators/product.ts` -- Zod-схеми товарів
- `src/validators/category.ts` -- Zod-схеми категорій
- `src/components/catalog/` -- FilterSidebar, CatalogToolbar, MobileFilterSheet
- `src/components/product/` -- PriceDisplay, ProductCarousel, QuantitySelector, ProductInfo, ProductJsonLd
- `src/app/(shop)/catalog/` -- сторінка каталогу
- `src/app/(shop)/product/[slug]/` -- сторінка товару
