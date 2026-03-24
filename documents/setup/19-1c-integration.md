# 19 — Інтеграція з 1С / BAS

Синхронізація товарів, замовлень, залишків і цін між магазином та 1С (або BAS).

## Як працює

```
1С/BAS  ──HTTP POST──►  /api/v1/integration/1c/*  ──►  БД магазину
                    (Bearer token авторизація)
```

1С відправляє дані на API магазину за розкладом або вручну. Магазин приймає дані, валідує і оновлює БД.

## Крок 1 — Змінні оточення

Додайте в `.env`:

```env
# 1С інтеграція
ONEC_API_TOKEN=your-secure-random-token-here
ONEC_SYNC_ENABLED=true
```

Згенерувати токен:

```bash
openssl rand -hex 32
```

## Крок 2 — API ендпоінти

| Метод | Endpoint | Що робить |
|-------|----------|-----------|
| POST | `/api/v1/integration/1c/products` | Синхронізація товарів (створення/оновлення) |
| POST | `/api/v1/integration/1c/stock` | Оновлення залишків |
| POST | `/api/v1/integration/1c/prices` | Оновлення цін |
| GET | `/api/v1/integration/1c/orders` | Отримання нових замовлень для 1С |

Всі ендпоінти авторизуються через header:

```
Authorization: Bearer YOUR_ONEC_API_TOKEN
```

## Крок 3 — Маппінг полів

### Товари (products)

| Поле 1С | Поле магазину | Тип | Обов'язкове |
|---------|---------------|-----|-------------|
| `Код` | `sku` | string | Так |
| `Наименование` | `name` | string | Так |
| `Цена` | `price` | number | Так |
| `Остаток` | `stock` | number | Так |
| `Артикул` | `article` | string | Ні |
| `Штрихкод` | `barcode` | string | Ні |
| `Единица` | `unit` | string | Ні |
| `Группа` | `categoryExternalId` | string | Ні |

### Замовлення (orders)

| Поле магазину | Поле 1С | Тип |
|---------------|---------|-----|
| `orderNumber` | `НомерЗаказа` | string |
| `status` | `Статус` | string |
| `items[].sku` | `Товары[].Код` | string |
| `items[].quantity` | `Товары[].Количество` | number |
| `items[].price` | `Товары[].Цена` | number |
| `customer.name` | `Покупатель` | string |
| `customer.phone` | `Телефон` | string |

## Крок 4 — Формат запитів

### Синхронізація товарів

```bash
curl -X POST http://your-domain.com/api/v1/integration/1c/products \
  -H "Authorization: Bearer YOUR_ONEC_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "products": [
      {
        "sku": "1C-001",
        "name": "Порошок для прання 3кг",
        "price": 289.00,
        "stock": 150,
        "barcode": "4820000000001"
      }
    ]
  }'
```

### Оновлення залишків

```bash
curl -X POST http://your-domain.com/api/v1/integration/1c/stock \
  -H "Authorization: Bearer YOUR_ONEC_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "sku": "1C-001", "stock": 150 },
      { "sku": "1C-002", "stock": 0 }
    ]
  }'
```

## Крок 5 — Налаштування в 1С

1. Створіть HTTP-з'єднання в 1С:
   - Сервер: `your-domain.com`
   - Порт: `443`
   - Захищене з'єднання: Так

2. Створіть обробку обміну з параметрами:
   - URL товарів: `/api/v1/integration/1c/products`
   - URL залишків: `/api/v1/integration/1c/stock`
   - URL замовлень: `/api/v1/integration/1c/orders`
   - Токен авторизації: значення з `ONEC_API_TOKEN`

3. Налаштуйте розклад обміну:
   - Товари і ціни: 1 раз на добу (ніч)
   - Залишки: кожні 15-30 хвилин
   - Замовлення: кожні 5-10 хвилин

## Troubleshooting

| Проблема | Рішення |
|----------|---------|
| 401 Unauthorized | Перевірте `ONEC_API_TOKEN` в `.env` і в налаштуваннях 1С |
| Товар не оновлюється | Перевірте що `sku` збігається між 1С і магазином |
| Дублікати товарів | `sku` має бути унікальним — використовуйте код номенклатури 1С |
| Таймаут при великих вивантаженнях | Відправляйте батчами по 100-500 товарів |
| Замовлення не з'являються в 1С | Перевірте що GET `/orders` повертає дані, і статус замовлення = `confirmed` |
