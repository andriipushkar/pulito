# Модуль доставки

## Огляд

Підтримка кількох способів доставки: Нова Пошта (основний, з автокомплітом міст і відділень + D2D кур'єром), Укрпошта (автокомпліт через address-classifier API), самовивіз та палетна доставка для гуртових клієнтів. Tracking-статуси оновлюються автоматично через cron.

## Способи доставки

| Метод            | Код           | Опис                                    |
| ---------------- | ------------- | --------------------------------------- |
| Нова Пошта       | `nova_poshta` | Основний спосіб, повна інтеграція з API |
| Укрпошта         | `ukrposhta`   | Альтернативний спосіб                   |
| Самовивіз        | `pickup`      | Зі складу/магазину                      |
| Палетна доставка | `pallet`      | Для великих гуртових замовлень          |

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

## Manual mode

Якщо **жоден** delivery-провайдер не сконфігурований (немає env-ключів і немає DB-ключів) → checkout автоматично показує текстове поле "Опишіть, як вам зручно отримати товар" замість списку радіо-кнопок (`config.delivery.manualMode = true`). На сабміті `deliveryMethod` встановлюється у `pickup`, а текст клієнта зберігається у `deliveryAddress`.

## Address book autofill

Для авторизованих клієнтів `/api/v1/me/saved-addresses` повертає до 5 унікальних останніх адрес з історії замовлень користувача. На кроці delivery checkout показуються як кнопки-пресети — клік підставляє все автоматично. Адреси фільтруються по поточно-доступних методах (якщо адмін вимкнув НП, NP-пресети не показуються).

## Нова Пошта

### API Integration (`src/services/nova-poshta.ts`)

Всі запити через `https://api.novaposhta.ua/v2.0/json/`. Кеденшіали через `getNovaPoshtaCreds()` (DB > env).

### Функції

**Пошук міст** (для autocomplete на checkout):

```ts
searchCities(query: string): Promise<Record<string, unknown>[]>
// modelName: 'Address', calledMethod: 'searchSettlements'
```

**Список відділень** (включно з поштоматами):

```ts
getWarehouses(cityRef: string, search?: string): Promise<Record<string, unknown>[]>
// modelName: 'Address', calledMethod: 'getWarehouses'
```

**Пошук вулиць** (для D2D кур'єрської доставки):

```ts
searchStreets(settlementRef: string, query: string): Promise<Record<string, unknown>[]>
// modelName: 'Address', calledMethod: 'searchSettlementStreets'
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

Параметри включають дані відправника, отримувача, тип вантажу, вагу, вартість. Опційні поля:

- `codAmount` — сума накладеного платежу (cash-on-delivery). Коли set, додається `BackwardDeliveryData` з `RedeliveryString`.
- `recipientStreetRef`, `recipientBuilding`, `recipientFlat` — для D2D адресної доставки (`serviceType: 'WarehouseDoors'`).

### Auto-create TTN

Коли статус замовлення → `confirmed` (або `shipped`), `updateOrderStatus` **автоматично** викликає `createInternetDocument` для NP-замовлень без TTN. Менеджеру не треба клацати "Створити ТТН" вручну. COD передається автоматично, якщо `paymentMethod='cod'` і `paymentStatus !== 'paid'`. D2D розпізнається за наявністю `deliveryStreetRef` + `deliveryBuilding`.

### Bulk TTN

`POST /api/v1/admin/orders/bulk-ttn` — приймає масив `orderIds` (до 100), створює TTN для кожного НП-замовлення, повертає `{ ok: [...], failed: [...] }`. UI: чекбокси на `/admin/orders` + кнопка "Створити ТТН (НП)". Restricted до `admin` ролі (manager не має — IDOR-protection).

### Auto-tracking cron

`POST /api/v1/cron/auto-tracking` (Bearer `APP_SECRET`) — пуляє NP API для всіх замовлень у `confirmed/paid/shipped` і:

- Зберігає поточний tracking-статус у `Order.trackingStatus` + `Order.trackingStatusAt`
- Якщо StatusCode = 9/11 (Delivered) → переводить замовлення у `completed`
- Сповіщає клієнта через Telegram

Schedule: GitHub Actions кожні 30 хв (`.github/workflows/cron-payments-tracking.yml`).

### API Endpoints

- `GET /api/v1/delivery/cities?q=<query>` — пошук міст НП
- `GET /api/v1/delivery/warehouses?cityRef=<ref>&q=<search>` — відділення
- `GET /api/v1/delivery/streets?cityRef=<ref>&q=<search>` — вулиці (для D2D)
- `GET /api/v1/delivery/ukrposhta-cities?q=<query>` — міста Укрпошти (з postal index)
- `POST /api/v1/delivery/estimate` — розрахунок вартості
- `GET /api/v1/delivery/tracking?provider=<np|up>&barcode=<...>` — відстеження
- `POST /api/v1/admin/orders/[id]/ttn` — створення TTN
- `POST /api/v1/admin/orders/bulk-ttn` — масове створення

### Обробка помилок

`NovaPoshtaError` з кодом статусу та повідомленням від API.

## Укрпошта

**Сервіс:** `src/services/ukrposhta.ts`

Використовує `UKRPOSHTA_BEARER_TOKEN` (env або DB через `getUkrposhtaCreds()`) для авторизованих ендпоінтів (tracking, shipment creation, label PDF).

**Search cities** використовує публічний `address-classifier-ws` API (без авторизації). Повертає назву + поштовий індекс + регіон, дозволяє автокомпліт на checkout.

## Палетна доставка

### Конфігурація (`src/services/pallet-delivery.ts`)

Налаштування зберігаються в `SiteSetting` під ключем `pallet_delivery_config`:

```ts
interface PalletConfig {
  enabled: boolean; // вкл/викл
  minWeightKg: number; // мінімальна вага (100 кг)
  maxWeightKg: number; // максимальна вага (5000 кг)
  basePrice: number; // базова вартість (1500 грн)
  pricePerKg: number; // ціна за кг (3 грн/кг)
  regions: {
    // регіональні множники
    name: string;
    multiplier: number;
  }[];
  freeDeliveryThreshold: number; // поріг безкоштовної доставки (50000 грн)
  estimatedDays: string; // орієнтовний термін ("3-5")
}
```

### Регіони (за замовчуванням)

| Регіон             | Множник |
| ------------------ | ------- |
| Київ та область    | 1.0     |
| Центральна Україна | 1.1     |
| Захід              | 1.3     |
| Схід               | 1.2     |
| Південь            | 1.2     |

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

- `src/components/checkout/StepDelivery.tsx` — вибір способу доставки + manual mode + pickup info display
- `src/components/checkout/NovaPoshtaPicker.tsx` — autocomplete міст + відділень + toggle warehouse/D2D + street autocomplete
- `src/components/checkout/UkrposhtaPicker.tsx` — autocomplete міст з поштовим індексом
- `src/components/checkout/DeliveryCostEstimate.tsx` — розрахунок вартості
- `src/components/checkout/PalletDeliveryForm.tsx` — форма палетної доставки
- `src/components/cart/CartSummary.tsx` — прогрес-бар безкоштовної доставки

## Файли модуля

- `src/services/nova-poshta.ts` — Нова Пошта API (cities, warehouses, streets, tracking, TTN)
- `src/services/ukrposhta.ts` — Укрпошта API (tracking, shipment, label, address-classifier)
- `src/services/pallet-delivery.ts` — палетна доставка
- `src/services/delivery-address.ts` — збережені адреси
- `src/services/checkout-config.ts` — manualMode, pickupInfo, freeShippingThreshold флаги
- `src/services/integration-credentials.ts` — DB > env credentials resolver
- `src/services/jobs/auto-tracking.ts` — cron для оновлення tracking-статусів
- `src/validators/delivery.ts` — Zod-схеми
- `src/validators/nova-poshta.ts` — валідація NP TTN параметрів (включно з codAmount, streetRef, building, flat)
- `src/validators/ukrposhta.ts` — валідація Ukrposhta параметрів
- `src/validators/pallet-delivery.ts` — валідація палетної доставки
- `src/app/api/v1/me/saved-addresses/route.ts` — address book endpoint
- `src/app/api/v1/admin/orders/bulk-ttn/route.ts` — масове створення TTN
