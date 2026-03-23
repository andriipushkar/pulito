# База даних -- Prisma Schema

Clean Shop використовує PostgreSQL через Prisma ORM. Генерований клієнт зберігається у `generated/prisma`.

## Основні сутності

### User (users)
Центральна модель системи. Зберігає дані клієнтів, менеджерів та адміністраторів.

- **Ролі** (`UserRole`): `client`, `wholesaler`, `manager`, `admin`
- **Оптовий статус** (`WholesaleStatus`): `none` -> `pending` -> `approved` / `rejected`
- **Тип власності** (`OwnershipType`): `fop`, `tov`, `pp`, `other`
- **Система оподаткування** (`TaxSystem`): `with_vat`, `without_vat`
- Поля для юридичних осіб: `companyName`, `edrpou`, `legalAddress`, `bankIban`, `bankName`, `bankMfo`
- Прив'язка до месенджерів: `googleId`, `telegramChatId`, `viberUserId`
- Само-зв'язок для менеджерів: `assignedManager` / `managedClients`
- Реферальний код: `referralCode` (unique)
- Налаштування сповіщень: `notificationPrefs` (JSON)

**Зв'язки:** orders, cartItems, wishlists, notifications, addresses, refreshTokens, recentlyViewed, searchHistory, productNotes, auditLogs, importLogs, personalPrices, referrals, clientEvents, publications, loyaltyAccount, pushSubscriptions

### Category (categories)
Деревоподібна структура категорій товарів.

- Само-зв'язок: `parent` / `children` (через `parentId`)
- SEO-поля: `seoTitle`, `seoDescription`
- Slug-based routing: `slug` (unique)
- Управління видимістю: `isVisible`, `sortOrder`
- Підтримка злиття категорій: `mergedFrom` (JSON)

### Product (products)
Товари магазину з повнотекстовим пошуком.

- Унікальні ідентифікатори: `code` (unique), `slug` (unique)
- Ціноутворення: `priceRetail`, `priceWholesale`, `priceRetailOld`, `priceWholesaleOld`
- Промо: `isPromo`, `promoStartDate`, `promoEndDate`
- Повнотекстовий пошук: `searchVector` (tsvector)
- Статистика: `viewsCount`, `ordersCount`

**Індекси:**
- `[categoryId]` -- фільтрація за категорією
- `[isActive, isPromo]` -- промо-товари
- `[priceRetail]` -- сортування за ціною
- `[createdAt DESC]` -- нові товари

### ProductContent (product_content)
Розширений контент товару (1:1 з Product).

- `shortDescription` (до 200 символів), `fullDescription`, `specifications`
- `usageInstructions`, `videoUrl`
- SEO-поля: `seoTitle`, `seoDescription`
- Статус заповнення: `isFilled`, `filledBy`

### ProductImage (product_images)
Зображення товарів з кількома розмірами.

- Розміри: `pathOriginal`, `pathFull`, `pathMedium`, `pathThumbnail`, `pathBlur`
- Метадані: `format`, `sizeBytes`, `width`, `height`
- `isMain` -- головне зображення
- Індекс: `[productId, sortOrder]`

### ProductBadge (product_badges)
Бейджі товарів для виділення на каталозі.

- **Типи** (`BadgeType`): `promo`, `new_arrival`, `hit`, `eco`, `custom`
- Кастомізація: `customText`, `customColor`

### ProductRecommendation (product_recommendations)
Рекомендації товарів.

- **Типи** (`RecommendationType`): `bought_together`, `similar`, `manual`
- `score` -- рейтинг рекомендації

### PriceHistory (price_history)
Історія змін цін товарів. Зберігає старі та нові роздрібні/оптові ціни.

---

## Замовлення та оплата

### Order (orders)
Замовлення з повним lifecycle.

- **Статуси** (`OrderStatus`): `new_order` -> `processing` -> `confirmed` -> `paid` -> `shipped` -> `completed` | `cancelled` | `returned`
- **Тип клієнта** (`ClientType`): `retail`, `wholesale`
- **Доставка** (`DeliveryMethod`): `nova_poshta`, `ukrposhta`, `pickup`, `pallet`
- **Оплата** (`PaymentMethod`): `cod`, `bank_transfer`, `online`, `card_prepay`
- **Статус оплати** (`PaymentStatus`): `pending`, `paid`, `partial`, `refunded`
- **Джерело** (`OrderSource`): `web`, `telegram_bot`, `viber_bot`
- UTM-мітки: `utmSource`, `utmMedium`, `utmCampaign`

**Індекси:**
- `[userId, createdAt DESC]` -- замовлення користувача
- `[status]`, `[status, createdAt]` -- фільтрація за статусом
- `[paymentStatus]`

### OrderItem (order_items)
Позиції замовлення. Зберігає `priceAtOrder` для фіксації ціни на момент замовлення.

### OrderStatusHistory (order_status_history)
Повна історія змін статусу. `ChangeSource`: `manager`, `client`, `system`, `cron`.

### Payment (payments)
Дані платежу (1:1 з Order). Провайдери: `liqpay`, `monobank`. Зберігає `callbackData` (JSON) та `invoicePdfUrl`.

### Delivery (deliveries)
Інформація про доставку (1:1 з Order). Статуси: `pending`, `shipped`, `in_transit`, `delivered`, `returned`.

---

## Кошик та списки бажань

### CartItem (cart_items)
Серверний кошик для авторизованих користувачів.
- Unique constraint: `[userId, productId]`

### Wishlist / WishlistItem (wishlists / wishlist_items)
Іменовані списки бажань з товарами.

---

## Сповіщення та комунікація

### UserNotification (user_notifications)
Внутрішні сповіщення. Типи: `order_status`, `price_change`, `back_in_stock`, `promo`, `system`.

### NotificationQueue (notification_queue)
Черга зовнішніх сповіщень. Канали: `email`, `telegram`, `viber`, `instagram`, `push`. Статуси: `pending`, `processing`, `sent`, `failed`. Підтримка retry з `maxAttempts`.

### PushSubscription (push_subscriptions)
Web Push підписки (PWA). Зберігає endpoint, p256dh, auth.

---

## Аналітика та аудит

### ClientEvent (client_events)
Події клієнтів для аналітики. Індекси: `[eventType, createdAt]`, `[userId, createdAt]`, `[sessionId]`.

### DailyFunnelStats (daily_funnel_stats)
Агреговані дані воронки продажів по днях: pageViews -> productViews -> addToCart -> cartViews -> checkoutStarts -> ordersCompleted.

### ChannelVisit (channel_visits)
Відстеження UTM-міток та конверсій з каналів.

### AuditLog (audit_log)
Журнал дій в системі. Типи: `login`, `logout`, `role_change`, `import`, `order_status_change`, `publication_create`, `theme_change`, `page_edit`, `rule_change`, `data_delete`.

### PerformanceMetric (performance_metrics)
Web Vitals (LCP, CLS, FID, TTFB, INP) по маршрутах з перцентилями p50/p75/p90.

---

## Контент та публікації

### Publication / PublicationImage (publications / publication_images)
Мультиканальні публікації (Telegram, Viber, Instagram). Статуси: `draft`, `scheduled`, `published`, `failed`. Зберігає ID медіа для кожної платформи та retry-логіку.

### StaticPage (static_pages)
Статичні сторінки з SEO та WYSIWYG-контентом.

### FaqItem (faq_items)
Питання та відповіді, згруповані за категоріями.

### EmailTemplate / EmailTemplateVersion (email_templates / email_template_versions)
Шаблони email з версіонуванням.

### Banner (banners)
Банери головної сторінки з адаптивними зображеннями.

### Theme (themes)
Теми оформлення з кастомними налаштуваннями.

---

## Лояльність та реферальна програма

### LoyaltyAccount (loyalty_accounts)
Обліковий запис лояльності (1:1 з User). Поля: `points`, `totalSpent`, `level`.

### LoyaltyTransaction (loyalty_transactions)
Транзакції балів. Типи: `earn`, `spend`, `manual_add`, `manual_deduct`, `expire`.

### LoyaltyLevel (loyalty_levels)
Налаштування рівнів лояльності: `minSpent`, `pointsMultiplier`, `discountPercent`.

### PersonalPrice (personal_prices)
Персональні ціни для оптових клієнтів. Може бути знижка (`discountPercent`) або фіксована ціна (`fixedPrice`) на продукт чи категорію.

### Referral (referrals)
Реферальна програма. Статуси: `registered` -> `first_order` -> `bonus_granted`.

---

## Боти та модерація

### BotAutoReply / BotWelcomeMessage (bot_auto_replies / bot_welcome_messages)
Автовідповіді та вітальні повідомлення для Telegram/Viber ботів. A/B-тестування через variant.

### ModerationRule / ModerationLog (moderation_rules / moderation_log)
Правила модерації та журнал застосувань.

### ChannelStats (channel_stats)
Статистика каналів (підписники, повідомлення, охоплення, engagement rate).

---

## Інше

### UserAddress (user_addresses)
Збережені адреси доставки з `isDefault`.

### RefreshToken (refresh_tokens)
JWT refresh-токени з хешем, device info, IP та TTL.

### RecentlyViewed (recently_viewed)
Нещодавно переглянуті товари.

### SearchHistory (search_history)
Історія пошукових запитів з результатами та кліками.

### WholesaleRule (wholesale_rules)
Правила для оптових клієнтів. Типи: `min_order_amount`, `min_quantity`, `multiplicity`.

### SeoTemplate (seo_templates)
Шаблони SEO тегів з placeholder-ами.

### Subscriber (subscribers)
Email-підписники з підтвердженням.

### ImportLog (import_log)
Журнал імпорту товарів з файлів.

### CookieConsent (cookie_consents)
Згоди на cookie (analytics, marketing).

### DashboardSettings (dashboard_settings)
Налаштування дашборду (layout, пороги, інтервал оновлення).

### ReportTemplate (report_templates)
Шаблони звітів зі сповіщеннями за розкладом.

### AnalyticsAlert (analytics_alerts)
Аналітичні сповіщення з умовами та каналами.

### SiteSetting (site_settings)
Key-value налаштування сайту (розклад ботів, конфігурація палетної доставки тощо).
