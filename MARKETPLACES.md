# Marketplace integrations — developer reference

Технічний референс по інтеграціях з OLX, Rozetka, Prom.ua, Epicentr K.
Користувацька довідка — у адмінці: `/admin/marketplaces/help`.

## Архітектура

```
Admin UI  →  API routes  →  Services layer  →  External APIs
                                ↓
                          Prisma (DB)
```

- **UI**: `src/app/(admin)/admin/marketplaces/*`
- **API**: `src/app/api/v1/admin/marketplaces/*`, `src/app/api/v1/cron/*`,
  `src/app/api/webhooks/marketplaces/[platform]`
- **Services**: `src/services/marketplaces.ts` (диспетчер + платформенні
  handlers), `marketplace-sync.ts` (фонова синхронізація), `channel-config.ts`
  (зашифровані credentials), `marketplace-rozetka.ts`, `marketplace-prom.ts`
  (специфічні клієнти).

## Підтримувані маркетплейси

| Платформа  | Публікація | Замовлення | Залишок |  Повідомлення  | Повернення |   OAuth   |
| ---------- | :--------: | :--------: | :-----: | :------------: | :--------: | :-------: |
| OLX        |     ✅     |     ✅     |   ✅    |       ✅       | ⚠️ (read)  |    ✅     |
| Rozetka    |     ✅     |     ✅     |   ✅    |       ✅       |     ✅     |  API key  |
| Prom.ua    |     ✅     |     ✅     |   ✅    |       ✅       |     ✅     | API token |
| Epicentr K |     ✅     |     ✅     |   ✅    | ❌ (немає API) | ⚠️ (read)  |  API key  |

## Конфігурація

Credentials зберігаються в `SiteSetting` під ключем `channel_<platform>` у
зашифрованому вигляді (`src/services/channel-config.ts`). Поля
SENSITIVE_FIELDS (apiKey, apiSecret, apiToken, accessToken, refreshToken,
clientSecret, password) шифруються через `@/lib/encryption`.

При збереженні маркетплейсних credentials система робить **merge**: порожні
sensitive-поля **не перезаписують** збережені значення (захист від випадкового
стирання токенів).

## Cron-задачі

| Endpoint                                      | Що робить                                        | Безпека                                                      |
| --------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| `POST /api/v1/cron/sync-marketplace-orders`   | Імпорт замовлень з усіх увімкнених маркетплейсів | `Authorization: Bearer ${APP_SECRET}` + `withCronLock(1800)` |
| `POST /api/v1/cron/sync-marketplace-stock`    | Push залишку на маркетплейси                     | Те саме                                                      |
| `POST /api/v1/cron/sync-marketplace-prices`   | Push цін                                         | Те саме                                                      |
| `POST /api/v1/cron/sync-marketplace-messages` | Пул повідомлень покупців                         | Те саме                                                      |
| `POST /api/v1/cron/marketplace-token-refresh` | Оновлення OLX refresh_token → access_token       | Те саме                                                      |
| `POST /api/v1/cron/marketplace-health-check`  | Періодичний пінг для uptime                      | Те саме                                                      |

## Стандартний цикл життя товару

1. Адмін публікує товар: POST `/api/v1/admin/products/:id/marketplaces` `{channel}`.
2. `publishToMarketplace()` → платформенний handler → зберігає `externalId` у
   `PublicationChannel`.
3. Cron `sync-marketplace-orders` (раз на 30 хв):
   - Тягне замовлення → створює `Order`+`OrderItem`.
   - Атомарно декрементує `product.quantity` по `productCode`.
   - Якщо локального залишку не вистачає — `quantity := 0` + Telegram-алерт
     `notifyManagerOversoldAlert`.
   - Після імпорту викликає `syncProductsStockToMarketplaces()` щоб усі інші
     маркетплейси побачили новий залишок.
4. Cron `sync-marketplace-prices` (раз на N годин): пушить актуальну ціну
   (з націнкою) для всіх опублікованих лістингів.

## Захист від overselu

- **stockAllocationPercent** (0–100): який відсоток локального залишку
  показувати конкретному маркетплейсу. Дефолт 100. Для високообертових
  товарів зменшуйте до 50–70%.
- **fulfilmentMode**: `'fbs'` (default) — продавець тримає товар; `'fbo'` —
  маркетплейс тримає товар, локальні декременти пропускаються.

## Повідомлення

- Storage: `MarketplaceMessage` (unique `[platform, externalThreadId]`).
- Cron `sync-marketplace-messages` тягне нові, upsert по externalThreadId.
- POST `/api/v1/admin/marketplaces/messages/reply` → `replyToMarketplaceMessage()`
  → API маркетплейсу. На успіх ставить `firstRespondedAt`.
- PATCH `/api/v1/admin/marketplaces/messages/:id` — призначення менеджера
  (`assigneeId`) та `isRead`.
- Шаблони: `MarketplaceReplyTemplate`, CRUD у `/reply-templates`.

## Повернення

- `MarketplaceReturn` синхронізується через cron + ручну кнопку
  POST `/api/v1/admin/marketplaces/returns`.
- PATCH `/api/v1/admin/marketplaces/returns/:id` `{status}` оновлює локально
  ТА викликає `pushReturnDecision()` для Rozetka/Prom (для OLX/Epicentr K —
  no-op, рішення треба підтверджувати в кабінеті).
- Прапорець `skipPush: true` дає змогу оновити статус без push (для
  реконсиляції stale-даних).

## Тестування

```bash
# Юніт-тести маркетплейсних сервісів
npx vitest run src/services/marketplace*.test.ts

# Тести API ендпоінтів
npx vitest run src/app/api/v1/admin/marketplaces

# Усі тести інтеграцій
npx vitest run src/services/channel-config.test.ts src/services/marketplaces.test.ts \
  src/services/marketplace-sync.test.ts
```

## Локальне налагодження

1. Скопіюйте `.env.example` → `.env`, заповніть `APP_URL`, `APP_SECRET`,
   `DATABASE_URL`, `TELEGRAM_*` (для алертів).
2. `npm run dev` — підняти Next.js на :3000.
3. У `/admin/marketplaces` → «Налаштування API» додайте sandbox-credentials.
4. Увімкніть **🧪 Sandbox / dry-run** — `publishToMarketplace()` повертає
   фейковий `externalId` без виклику API.

## Безпека

- Webhooks: `src/app/api/webhooks/marketplaces/[platform]/route.ts` перевіряє
  HMAC підпис (`verifySignature()`).
- Усі admin-ендпоінти захищені `withRole('admin', 'manager')`.
- Чутливі поля API повертаються в masked-вигляді (`maskChannelConfig()`).

## Розширення

Щоб додати ще один маркетплейс:

1. Додайте `'newmp'` до `MARKETPLACE_CHANNELS` у `marketplaces.ts`.
2. Додайте handler-функції: `publishToNewmp`, `updateNewmpListing`,
   `deleteNewmpListing`, `getNewmpOrders`, `getNewmpMessages`, тощо.
3. Додайте case до диспетчерів у `publishToMarketplace()`,
   `updateMarketplaceListing()`, `deleteMarketplaceListing()`,
   `getMarketplaceMessages()`, `replyToMarketplaceMessage()`.
4. Додайте до `MARKETPLACES` у
   `src/app/(admin)/admin/marketplaces/_shared.ts` (icon, fields, supports).
5. Додайте до cron-роутів (`sync-marketplace-orders` уже автоматично
   ітерує `MARKETPLACE_CHANNELS`).
6. Напишіть тести для нових handler-функцій.
