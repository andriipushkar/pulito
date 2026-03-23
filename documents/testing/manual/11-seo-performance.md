# 11 — SEO, продуктивність, кешування

---

## 11.1 Sitemap

### TC-SP-1.1 Основний Sitemap
**Передумова:** Сайт розгорнуто на тестовому середовищі, відкрити Chrome DevTools
**Кроки:**
1. Відкрити `/sitemap.xml`
2. Перевірити що є: головна, каталог, FAQ, товари, категорії, сторінки
3. Перевірити формат: `<url><loc>`, `<lastmod>`, `<priority>`
**Очікуваний результат:** Валідний XML sitemap з усіма сторінками
**Статус:** ⬜

### TC-SP-1.2 Chunked Sitemap (товари)
**Передумова:** Сайт розгорнуто на тестовому середовищі, відкрити Chrome DevTools
**Кроки:**
1. Відкрити `/sitemap-products/0`
2. Перевірити XML з товарами
3. Відкрити `/sitemap-products/1` (якщо товарів > 5000)
**Очікуваний результат:** XML з товарами, до 5000 на чанк
**Статус:** ⬜

---

## 11.2 Robots.txt

### TC-SP-2.1 Перевірка robots.txt
**Передумова:** Сайт розгорнуто на тестовому середовищі, відкрити Chrome DevTools
**Кроки:**
1. Відкрити `/robots.txt`
2. Перевірити: Sitemap URL, Allow/Disallow правила
**Очікуваний результат:** Коректний robots.txt з посиланням на sitemap
**Статус:** ⬜

---

## 11.3 Meta теги та OG

### TC-SP-3.1 Meta теги головної
**Передумова:** Сайт розгорнуто на тестовому середовищі, відкрити Chrome DevTools
**Кроки:**
1. Відкрити `/` → View Source
2. Перевірити: `<title>`, `<meta name="description">`, `<meta property="og:*">`
**Очікуваний результат:** Всі meta теги заповнені
**Статус:** ⬜

### TC-SP-3.2 Meta теги товару
**Передумова:** Сайт розгорнуто на тестовому середовищі, відкрити Chrome DevTools
**Кроки:**
1. Відкрити `/product/[slug]` → View Source
2. Перевірити: title з назвою товару, description, og:image, og:price
**Очікуваний результат:** Унікальні meta для кожного товару
**Статус:** ⬜

### TC-SP-3.3 JSON-LD розмітка
**Передумова:** Сайт розгорнуто на тестовому середовищі, відкрити Chrome DevTools
**Кроки:**
1. На головній: `<script type="application/ld+json">` — Organization, WebSite
2. На товарі: Product з ціною, рейтингом, наявністю
3. На FAQ: FAQPage з питаннями/відповідями
**Очікуваний результат:** Валідний JSON-LD (перевірити через search.google.com/test/rich-results)
**Статус:** ⬜

---

## 11.4 Dynamic OG Images

### TC-SP-4.1 OG зображення для товару
**Передумова:** Сайт розгорнуто на тестовому середовищі, відкрити Chrome DevTools
**Кроки:**
1. Відкрити View Source на сторінці товару
2. Знайти `<meta property="og:image" content="...">`
3. Відкрити URL зображення
**Очікуваний результат:** Динамічне зображення з назвою та ціною товару
**Статус:** ⬜

### TC-SP-4.2 Прев'ю в Telegram/Viber
**Передумова:** Сайт розгорнуто на тестовому середовищі, відкрити Chrome DevTools
**Кроки:**
1. Скопіювати URL товару
2. Вставити в Telegram чат
3. Перевірити прев'ю: зображення, назва, ціна
**Очікуваний результат:** Гарне прев'ю з ціною
**Статус:** ⬜

---

## 11.5 Кешування (ISR)

### TC-SP-5.1 Каталог (revalidate=60s)
**Передумова:** Сайт розгорнуто на тестовому середовищі, відкрити Chrome DevTools
**Кроки:**
1. Відкрити `/catalog` — зафіксувати час
2. В адмінці змінити ціну товару
3. Оновити `/catalog` — ціна стара
4. Зачекати 60 секунд, оновити
**Очікуваний результат:** Через 60с ціна оновлюється
**Статус:** ⬜

### TC-SP-5.2 Товар (revalidate=120s)
**Передумова:** Сайт розгорнуто на тестовому середовищі, відкрити Chrome DevTools
**Кроки:**
1. Відкрити `/product/[slug]`
2. В адмінці змінити опис
3. Зачекати до 120с → оновити
**Очікуваний результат:** Через 120с опис оновлюється
**Статус:** ⬜

---

## 11.6 Швидкодія

### TC-SP-6.1 PageSpeed (Desktop)
**Передумова:** Очистити кеш браузера, відкрити Chrome Lighthouse
**Кроки:**
1. Відкрити https://pagespeed.web.dev
2. Ввести URL головної
3. Перевірити оцінки: Performance, Accessibility, Best Practices, SEO
**Очікуваний результат:** Performance > 80, SEO > 90
**Статус:** ⬜

### TC-SP-6.2 PageSpeed (Mobile)
**Передумова:** Очистити кеш браузера, відкрити Chrome Lighthouse
**Кроки:**
1. Те саме для мобільної версії
**Очікуваний результат:** Performance > 60, SEO > 90
**Статус:** ⬜

### TC-SP-6.3 RSS Feed
**Передумова:** Сайт розгорнуто на тестовому середовищі, відкрити Chrome DevTools
**Кроки:**
1. Відкрити `/feed.xml`
**Очікуваний результат:** Валідний RSS з новими товарами
**Статус:** ⬜

---

## 11.7 Негативні та граничні сценарії SEO/Performance

### TC-SP-7.1 Сторінка без meta description
**Передумова:** Створити сторінку в адмінці `/admin/pages/new` без заповнення поля meta description
**Тестові дані:**
- URL сторінки: `/page/test-no-meta`
- Title: "Тестова сторінка"
- Meta description: (порожнє)
**Кроки:**
1. В адмінці створити сторінку без meta description
2. Відкрити `/page/test-no-meta` → View Source
3. Перевірити наявність `<meta name="description">`
4. Запустити Lighthouse audit (SEO категорія)
**Очікуваний результат:** Lighthouse SEO audit показує warning: "Document does not have a meta description". Тег `<meta name="description">` відсутній або має порожній content. SEO score знижено.
**Статус:** ⬜

### TC-SP-7.2 Зображення без alt text
**Передумова:** Увійти як `admin@test.com` (роль: admin). Додати товар із зображенням, залишивши поле alt порожнім.
**Тестові дані:**
- Товар: "Тестовий засіб"
- Зображення: завантажити JPEG
- Alt text: (порожнє)
**Кроки:**
1. В адмінці створити товар з зображенням без alt тексту
2. Відкрити сторінку товару `/product/test-zasib`
3. Inspect element — знайти `<img>` тег
4. Запустити Lighthouse audit (Accessibility категорія)
**Очікуваний результат:** Lighthouse Accessibility warning: "Image elements do not have [alt] attributes". Елемент `<img>` без атрибуту `alt` або з порожнім `alt=""`. Accessibility score знижено.
**Статус:** ⬜

### TC-SP-7.3 Broken canonical URL
**Передумова:** Сторінка з canonical URL, що вказує на неіснуючий URL
**Тестові дані:**
- Сторінка: `/product/existing-product`
- Canonical URL (встановлений вручну через адмінку): `https://shop.com/product/deleted-product`
**Кроки:**
1. В адмінці для товару встановити canonical URL на неіснуючу сторінку
2. Відкрити сторінку товару → View Source
3. Знайти `<link rel="canonical" href="...">`
4. Відкрити canonical URL — переконатися що він повертає 404
5. Перевірити через SEO audit tool (ahrefs, screaming frog, або Lighthouse)
**Очікуваний результат:** SEO audit показує помилку: "Canonical URL returns 404". Пошуковий робот не може проіндексувати canonical сторінку. Рекомендація: виправити canonical на актуальний URL.
**Статус:** ⬜

### TC-SP-7.4 robots.txt блокує важливу сторінку
**Передумова:** Доступ до конфігурації `robots.txt` через адмінку або файл
**Тестові дані:**
- Правило: `Disallow: /catalog`
**Кроки:**
1. Додати правило `Disallow: /catalog` в robots.txt (через адмінку або конфіг)
2. Відкрити `/robots.txt` — переконатися що правило додано
3. Перевірити через Google Search Console (або robots.txt tester)
4. Спробувати перевірити `/catalog` — чи заблоковано для crawl
**Очікуваний результат:** Crawl error: сторінка `/catalog` заблокована для індексації. Google Search Console показує попередження: "Blocked by robots.txt". Важливий контент недоступний для пошукових систем.
**Статус:** ⬜

### TC-SP-7.5 Sitemap містить сторінку з 404
**Передумова:** Видалити товар, який присутній в sitemap
**Тестові дані:**
- Товар для видалення: "Застарілий засіб" (slug: `zastariliy-zasib`)
**Кроки:**
1. Переконатися що `/product/zastariliy-zasib` є в `/sitemap.xml`
2. В адмінці видалити товар "Застарілий засіб"
3. Відкрити `/sitemap.xml` — перевірити чи URL ще присутній
4. Відкрити `/product/zastariliy-zasib` — переконатися що 404
5. Перевірити через sitemap validator (xml-sitemaps.com/validate)
**Очікуваний результат:** Sitemap validation error: URL `/product/zastariliy-zasib` повертає 404. Sitemap повинен автоматично виключати видалені товари. Якщо не виключає — це баг, сторінка має бути прибрана при наступному revalidate.
**Статус:** ⬜

### TC-SP-7.6 OG image відсутній — прев'ю в соціальних мережах
**Передумова:** Сторінка без OG image (наприклад, інформаційна сторінка без зображення)
**Тестові дані:**
- URL сторінки: `/page/about` (без встановленого og:image)
**Кроки:**
1. Відкрити `/page/about` → View Source
2. Перевірити наявність `<meta property="og:image">`
3. Скопіювати URL та вставити в Telegram або Facebook debugger (developers.facebook.com/tools/debug)
4. Перевірити прев'ю
**Очікуваний результат:** Прев'ю без зображення: лише заголовок та опис. Facebook debugger показує warning: "og:image tag missing". Telegram не відображає картинку у прев'ю посилання. Рекомендація: додати fallback OG image.
**Статус:** ⬜

### TC-SP-7.7 Page load >3s на повільному з'єднанні (3G)
**Передумова:** Chrome DevTools, мережа throttled до Slow 3G
**Тестові дані:**
- URL: `/catalog` (сторінка з великою кількістю товарів)
- Мережа: Slow 3G (DevTools → Network → Throttling)
**Кроки:**
1. Відкрити Chrome DevTools → Network → Throttling → Slow 3G
2. Відкрити `/catalog`
3. Зафіксувати час повного завантаження (Load event)
4. Запустити Lighthouse Performance audit з mobile throttling
5. Перевірити метрики: FCP, LCP, TBT
**Очікуваний результат:** Якщо час завантаження >3 секунди: Lighthouse Performance score <50. LCP (Largest Contentful Paint) >4s. Warning: "Reduce initial server response time", "Properly size images", "Eliminate render-blocking resources". Сторінка потребує оптимізації для повільних з'єднань.
**Статус:** ⬜
