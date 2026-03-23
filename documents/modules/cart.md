# Модуль кошика

## Огляд

Кошик реалізований як гібридна система: гостьовий кошик зберігається в localStorage через React Context, а серверний кошик для авторизованих користувачів -- в базі даних. При логіні відбувається злиття (merge) кошиків.

## Гостьовий кошик (Client-side)

### CartProvider (`src/providers/CartProvider.tsx`)

React Context Provider з `useReducer` для управління станом.

**Ключ localStorage:** `clean-shop-cart`

### Стан кошика (CartItem)
```ts
interface CartItem {
  productId: number;
  name: string;
  slug: string;
  code: string;
  priceRetail: number;
  priceWholesale: number | null;
  imagePath: string | null;
  quantity: number;
  maxQuantity: number;
}
```

### Дії (Actions)
| Дія | Опис |
|-----|------|
| `SET_ITEMS` | Завантаження з localStorage |
| `ADD_ITEM` | Додавання товару (або збільшення кількості) |
| `REMOVE_ITEM` | Видалення товару |
| `UPDATE_QUANTITY` | Зміна кількості (min 1, max maxQuantity) |
| `CLEAR` | Очищення кошика |

### API контексту (CartContextValue)
```ts
{
  items: CartItem[];
  itemCount: number;           // сума quantity всіх items
  total: (role?: string) => number;  // загальна сума (wholesale price для wholesaler)
  addItem: (item: CartItem) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
}
```

### useCart хук (`src/hooks/useCart.ts`)
```ts
const { items, itemCount, total, addItem, removeItem, updateQuantity, clearCart } = useCart();
```

### Розрахунок вартості
Метод `total(role?)` автоматично обирає ціну:
- `role === 'wholesaler'` && `priceWholesale` -- оптова ціна
- Інакше -- роздрібна ціна

## Серверний кошик (Server-side)

### Модель CartItem (Prisma)
```
CartItem {
  userId    -> User
  productId -> Product
  quantity  Int
  addedAt   DateTime
}
// Unique: [userId, productId]
```

### Ендпоінти
- `GET /api/v1/cart` -- список товарів у кошику
- `POST /api/v1/cart` -- додати товар
- `PUT /api/v1/cart/:productId` -- змінити кількість
- `DELETE /api/v1/cart/:productId` -- видалити товар
- `POST /api/v1/cart/merge` -- злити гостьовий кошик з серверним

### Сервіс (`src/services/cart.ts`)

**getCartItems(userId):**
- Повертає товари з повною інформацією про продукт
- Фільтрує неактивні товари (`isActive`)

**getCartWithPersonalPrices(userId):**
- Додає персональну ціну для кожного товару
- Перевіряє `PersonalPrice` (фіксована ціна або знижка відсотком)

**addToCart(userId, productId, quantity):**
- Перевіряє активність товару
- Перевіряє достатність залишків
- Якщо товар вже в кошику -- збільшує кількість

**updateCartItem(userId, productId, quantity):**
- Перевіряє наявність в кошику
- Перевіряє залишки

**removeFromCart(userId, productId):**
- Видаляє позицію з кошика

**clearCart(userId):**
- Видаляє всі позиції

**mergeCart(userId, localItems):**
- Зливає гостьовий кошик з серверним
- Не перезаписує існуючі позиції
- Перевіряє активність та наявність товарів
- Повертає оновлений серверний кошик

## Оптові правила

Перед оформленням замовлення для оптовиків перевіряються `WholesaleRule`:

| Тип правила | Опис |
|-------------|------|
| `min_order_amount` | Мінімальна сума замовлення (глобальна) |
| `min_quantity` | Мінімальна кількість одного товару |
| `multiplicity` | Кратність замовлення (наприклад, тільки по 6 шт.) |

Правила можуть бути глобальними (`productId = null`) або для конкретного товару.

## Checkout

### Процес оформлення

Checkout реалізований як покроковий wizard:

1. **StepContacts** -- контактна інформація (ім'я, телефон, email, компанія для оптовиків)
2. **StepDelivery** -- спосіб доставки (Nova Poshta, Ukrposhta, самовивіз, палетна)
3. **StepPayment** -- спосіб оплати (накладений платіж, банківський переказ, онлайн, передоплата на картку)
4. **StepConfirmation** -- підтвердження замовлення

### Компоненти
- `src/components/checkout/CheckoutSteps.tsx` -- навігація кроками
- `src/components/checkout/StepContacts.tsx`
- `src/components/checkout/StepDelivery.tsx`
- `src/components/checkout/StepPayment.tsx`
- `src/components/checkout/StepConfirmation.tsx`
- `src/components/checkout/DeliveryCostEstimate.tsx` -- розрахунок вартості доставки
- `src/components/checkout/PalletDeliveryForm.tsx` -- форма палетної доставки
- `src/components/checkout/OrderSuccess.tsx` -- сторінка успішного замовлення

### Валідація (checkoutSchema)
- `contactName` -- мін 2 символи
- `contactPhone` -- мін 10 символів
- `contactEmail` -- валідний email
- `deliveryMethod` -- `nova_poshta` | `ukrposhta` | `pickup` | `pallet`
- `paymentMethod` -- `cod` | `bank_transfer` | `online` | `card_prepay`
- `loyaltyPointsToSpend` -- опціонально, >= 0
- `paymentProvider` -- `liqpay` | `monobank` (для online)

## UI компоненти

- `src/components/cart/CartItemRow.tsx` -- рядок товару в кошику
- `src/components/cart/CartSummary.tsx` -- підсумок кошика

## Файли модуля

- `src/providers/CartProvider.tsx` -- React Context (client-side)
- `src/hooks/useCart.ts` -- хук для доступу до контексту
- `src/services/cart.ts` -- серверна логіка кошика
- `src/validators/order.ts` -- схеми валідації checkout
- `src/app/api/v1/cart/` -- API ендпоінти
- `src/app/(shop)/cart/` -- сторінка кошика
- `src/app/(shop)/checkout/` -- сторінка checkout
- `src/components/cart/` -- UI компоненти кошика
- `src/components/checkout/` -- UI компоненти checkout
