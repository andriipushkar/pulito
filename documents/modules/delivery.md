# Модуль доставки

## Огляд

Підтримка кількох способів доставки: Нова Пошта (основний), Укрпошта, самовивіз та палетна доставка для оптових клієнтів.

## Способи доставки

| Метод | Код | Опис |
|-------|-----|------|
| Нова Пошта | `nova_poshta` | Основний спосіб, повна інтеграція з API |
| Укрпошта | `ukrposhta` | Альтернативний спосіб |
| Самовивіз | `pickup` | Зі складу/магазину |
| Палетна доставка | `pallet` | Для великих оптових замовлень |

## Статуси доставки

```
pending -> shipped -> in_transit -> delivered
                                      |
                                      v
                                   returned
```

## Модель Delivery (Prisma)

```
Delivery {
  orderId               -> Order (unique, 1:1)
  deliveryMethod        DeliveryMethod
  deliveryStatus        DeliveryStatus
  city                  String?
  warehouseRef          String?
  addressText           String?
  trackingNumber        String?
  trackingUrl           String?
  estimatedDeliveryDate DateTime?
  actualDeliveryDate    DateTime?
  deliveryCost          Decimal
  weightKg              Decimal?
  createdBy             -> User?
}
```

## Нова Пошта

### API Integration (`src/services/nova-poshta.ts`)

Всі запити через `https://api.novaposhta.ua/v2.0/json/`.

### Функції

**Пошук міст:**
```ts
searchCities(query: string): Promise<Record<string, unknown>[]>
// modelName: 'Address', calledMethod: 'searchSettlements'
```

**Список відділень:**
```ts
getWarehouses(cityRef: string, search?: string): Promise<Record<string, unknown>[]>
// modelName: 'Address', calledMethod: 'getWarehouses'
```

**Відстеження:**
```ts
trackParcel(ttn: string): Promise<Record<string, unknown>[]>
// modelName: 'TrackingDocument', calledMethod: 'getStatusDocuments'
```

**Розрахунок вартості:**
```ts
estimateDeliveryCost(input: EstimateDeliveryInput): Promise<DeliveryCostEstimate>
// modelName: 'InternetDocument', calledMethod: 'getDocumentPrice'
```

Вхідні параметри:
- `citySender`, `cityRecipient` -- Ref міста відправника/отримувача
- `weight` -- вага (кг)
- `serviceType` -- `WarehouseWarehouse`, `WarehouseDoors`, `DoorsWarehouse`, `DoorsDoors`
- `cost` -- оголошена вартість
- `seatsAmount` -- кількість місць

Результат: `{ cost, estimatedDays }`

**Створення ТТН (експрес-накладної):**
```ts
createInternetDocument(input: CreateTTNInput): Promise<{
  intDocNumber: string;
  ref: string;
  costOnSite: number;
  estimatedDeliveryDate: string;
}>
// modelName: 'InternetDocument', calledMethod: 'save'
```

Параметри включають дані відправника, отримувача, тип вантажу, вагу, вартість.

### API Endpoints

- `GET /api/v1/nova-poshta/cities?q=<query>` -- пошук міст
- `GET /api/v1/nova-poshta/warehouses?cityRef=<ref>&q=<search>` -- відділення
- `POST /api/v1/nova-poshta/estimate` -- розрахунок вартості
- `GET /api/v1/nova-poshta/track/:ttn` -- відстеження

### Обробка помилок
`NovaPoshtaError` з кодом статусу та повідомленням від API.

## Укрпошта

**Сервіс:** `src/services/ukrposhta.ts`

Використовує `UKRPOSHTA_BEARER_TOKEN` для автентифікації.

## Палетна доставка

### Конфігурація (`src/services/pallet-delivery.ts`)

Налаштування зберігаються в `SiteSetting` під ключем `pallet_delivery_config`:

```ts
interface PalletConfig {
  enabled: boolean;            // вкл/викл
  minWeightKg: number;         // мінімальна вага (100 кг)
  maxWeightKg: number;         // максимальна вага (5000 кг)
  basePrice: number;           // базова вартість (1500 грн)
  pricePerKg: number;          // ціна за кг (3 грн/кг)
  regions: {                   // регіональні множники
    name: string;
    multiplier: number;
  }[];
  freeDeliveryThreshold: number; // поріг безкоштовної доставки (50000 грн)
  estimatedDays: string;        // орієнтовний термін ("3-5")
}
```

### Регіони (за замовчуванням)

| Регіон | Множник |
|--------|---------|
| Київ та область | 1.0 |
| Центральна Україна | 1.1 |
| Захід | 1.3 |
| Схід | 1.2 |
| Південь | 1.2 |

### Розрахунок вартості

```
cost = (basePrice + weightKg * pricePerKg) * regionMultiplier
```

**Функція:** `calculatePalletDeliveryCost(weightKg, region?)`

Повертає: `{ cost, estimatedDays, isFreeDelivery }`

### Валідація замовлення

**Функція:** `validatePalletOrder(totalWeightKg, region?)`

Перевіряє:
- Увімкненість палетної доставки
- Мінімальну/максимальну вагу
- Підтримку регіону

### Адмін-панель

- `GET /api/v1/admin/pallet-delivery/config` -- отримання конфігурації
- `PUT /api/v1/admin/pallet-delivery/config` -- оновлення конфігурації
- `POST /api/v1/admin/pallet-delivery/estimate` -- розрахунок вартості

## UI компоненти

- `src/components/checkout/StepDelivery.tsx` -- вибір способу доставки
- `src/components/checkout/DeliveryCostEstimate.tsx` -- розрахунок вартості
- `src/components/checkout/PalletDeliveryForm.tsx` -- форма палетної доставки

## Файли модуля

- `src/services/nova-poshta.ts` -- Нова Пошта API
- `src/services/ukrposhta.ts` -- Укрпошта API
- `src/services/pallet-delivery.ts` -- палетна доставка
- `src/services/delivery-address.ts` -- збережені адреси
- `src/validators/delivery.ts` -- Zod-схеми
- `src/validators/nova-poshta.ts` -- валідація Nova Poshta параметрів
- `src/validators/ukrposhta.ts` -- валідація Ukrposhta параметрів
- `src/validators/pallet-delivery.ts` -- валідація палетної доставки
