# Налаштування служб доставки

Pulito підтримує дві служби доставки: Нова Пошта та Укрпошта.

## Нова Пошта

### Крок 1 — Зареєструватись та отримати API-ключ

1. Перейдіть на **https://novaposhta.ua/**
2. Зареєструйтесь або увійдіть у особистий кабінет
3. Перейдіть у **Налаштування** → **Безпека** → **API ключі**
4. Натисніть **Створити ключ**
5. Скопіюйте згенерований API-ключ

> API Нової Пошти — версія 2.0. Документація: https://developers.novaposhta.ua/

### Крок 2 — Додати в .env (або в адмінку)

```env
NOVA_POSHTA_API_KEY=your_api_key_here
```

Альтернатива: відкрий `/admin/delivery-settings` і впиши ключ прямо в адмінці — DB має пріоритет над env, перезапуск не потрібен.

### Крок 3 — Налаштувати відправника в адмін-панелі

1. Зайдіть в адмін-панель → **Налаштування** → **Доставка**
2. Вкажіть дані відправника:
   - Місто відправлення
   - Відділення / поштомат
   - Контактна особа
   - Телефон
3. Збережіть

### Крок 4 — Тестування

**Пошук міст:**

```bash
curl -X POST "https://api.novaposhta.ua/v2.0/json/" \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_API_KEY",
    "modelName": "Address",
    "calledMethod": "searchSettlements",
    "methodProperties": {
      "CityName": "Київ",
      "Limit": "5"
    }
  }'
```

**Пошук відділень:**

```bash
curl -X POST "https://api.novaposhta.ua/v2.0/json/" \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "YOUR_API_KEY",
    "modelName": "Address",
    "calledMethod": "getWarehouses",
    "methodProperties": {
      "CityName": "Київ",
      "Limit": "10"
    }
  }'
```

**Перевірка на сайті:**

1. Додайте товар у кошик
2. Перейдіть до оформлення замовлення
3. Оберіть доставку "Нова Пошта"
4. У picker-і — почніть вводити "Київ" → має з'явитися autocomplete-список міст
5. Оберіть місто → з'явиться autocomplete для відділень/поштоматів
6. Знайдіть і оберіть відділення → оформіть замовлення

### D2D адресна доставка (кур'єром)

В picker-і клієнт може перемкнути режим на **"🚚 Адресна (кур'єр)"**:

1. Обирає місто (autocomplete)
2. Обирає вулицю — autocomplete з NP API `searchSettlementStreets`
3. Вводить будинок і квартиру вручну
4. На сабміті зберігаються:
   - `deliveryStreetRef` (UUID вулиці)
   - `deliveryBuilding`, `deliveryFlat` (текст)
5. При створенні TTN автоматично використовується `serviceType: 'WarehouseDoors'` з структурованими полями `RecipientStreet/RecipientHouse/RecipientFlat`

### Створення ТТН (експрес-накладної)

Є **3 способи** створення TTN:

#### A. Авто (рекомендовано)

При зміні статусу замовлення на `confirmed` (або `shipped`) — система **автоматично** створить TTN:

- Якщо `paymentMethod='cod'` і не оплачено → додасть `BackwardDeliveryData` з сумою накладеного платежу
- Якщо є `deliveryStreetRef + deliveryBuilding` → створить D2D-накладну
- Інакше — стандартна warehouse-warehouse

Менеджеру не треба клацати "Створити ТТН" вручну для кожного замовлення.

#### B. Вручну (для одного)

1. Відкрийте замовлення в адмін-панелі
2. Натисніть **Створити ТТН**
3. Перевірте дані відправника/отримувача
4. Підтвердіть → номер ТТН з'явиться в замовленні

#### C. Bulk (для масового створення)

1. На сторінці `/admin/orders` поставте чекбокси на потрібні замовлення (до 100 за раз)
2. У toolbar з'явиться кнопка **"Створити ТТН (НП)"**
3. Клік → endpoint `POST /api/v1/admin/orders/bulk-ttn` створить TTN послідовно
4. Toast покаже "Створено N ТТН" + список тих, що не вдалось (з причиною: вже є TTN, не НП, без даних, NP API error)

**Restrictions**: bulk-ttn доступний тільки для ролі `admin` (manager не має).

---

## Укрпошта

### Крок 1 — Отримати Bearer Token

1. Перейдіть на **https://www.ukrposhta.ua/ua** → **Для бізнесу**
2. Зареєструйтесь як бізнес-клієнт
3. Зверніться до підтримки або скористайтесь API-порталом для отримання Bearer Token
4. Документація API: https://dev.ukrposhta.ua/

> Укрпошта використовує StatusTracking API для відстеження відправлень.

### Крок 2 — Додати в .env (або в адмінку)

```env
UKRPOSHTA_BEARER_TOKEN=your_bearer_token_here
```

Bearer token потрібен **тільки для tracking, label PDF і shipment creation**. Search cities для autocomplete на чекауті використовує **публічний** address-classifier API без авторизації — нічого не треба налаштовувати додатково.

### Крок 3 — Тестування

**Відстеження відправлення:**

```bash
curl -X GET "https://www.ukrposhta.ua/status-tracking/0.0.1/statuses/last?barcode=0500000000000" \
  -H "Authorization: Bearer YOUR_BEARER_TOKEN" \
  -H "Content-Type: application/json"
```

**Перевірка на сайті:**

1. Оберіть доставку "Укрпошта" при оформленні замовлення
2. У полі "Місто" почніть вводити — має з'явитись autocomplete з назвами і поштовими індексами
3. Оберіть місто, впишіть адресу
4. Після створення ТТН — перевірте відстеження статусу

---

## Автоматичне відстеження

Cron-задача `auto-tracking` (кожні **30 хвилин**) автоматично перевіряє статуси всіх активних відправлень.

**Endpoint:** `POST /api/v1/cron/auto-tracking` (Bearer `APP_SECRET`)

**Schedule:**

- GitHub Actions: `.github/workflows/cron-payments-tracking.yml` (firing twice an hour: :00 і :30)
- Або self-hosted crontab:
  ```
  */30 * * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/auto-tracking
  ```

**Що робить:**

- Бере замовлення в статусах `confirmed/paid/shipped` з `trackingNumber`
- Запитує NP API про поточний статус
- **Зберігає** текст статусу ("В дорозі", "Прибуло у відділення", "Видана") у `Order.trackingStatus` + `trackingStatusAt`
- Якщо StatusCode 9/11 (Delivered) → переводить замовлення в `completed`
- Сповіщає клієнта через Telegram про доставку

Клієнт бачить актуальний статус на `/account/orders/<id>` без власних запитів до NP API.

## Pickup point

Якщо адмін задав `delivery_pickup_address` / `delivery_pickup_hours` / `delivery_pickup_phone` (адмінка `/admin/delivery-settings`), на чекауті при виборі "Самовивіз" клієнт побачить блок з адресою/графіком/телефоном складу.

## Free delivery threshold

Якщо адмін задав `delivery_free_shipping_threshold` (грн), на сторінці `/cart`:

- Прогрес-бар "Додайте ще X ₴ для безкоштовної доставки" коли `cartTotal < threshold`
- Зелений банер "Безкоштовна доставка вам нараховується" коли досягнуто

## Усунення проблем

### Нова Пошта — "API key is not valid"

- Перевірте, що ключ скопійований повністю
- Переконайтеся, що ключ активний у кабінеті Нової Пошти

### Нова Пошта — міста не завантажуються

- Перевірте підключення до інтернету
- Перевірте логи: `pm2 logs pulito | grep "nova"`

### Укрпошта — "401 Unauthorized"

- Перевірте термін дії Bearer Token
- Зверніться до підтримки Укрпошти для оновлення токену
