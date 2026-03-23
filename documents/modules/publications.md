# Модуль публікацій

## Огляд

Мультиканальна система публікацій дозволяє створювати контент та публікувати його одночасно в Telegram, Viber та Instagram. Підтримує планування, retry-логіку та різні формати медіа.

## Статуси публікації

| Статус | Опис |
|--------|------|
| `draft` | Чернетка |
| `scheduled` | Запланована на конкретний час |
| `published` | Опублікована |
| `failed` | Помилка публікації |

## Модель Publication (Prisma)

```
Publication {
  title          String
  content        String
  imagePath      String?
  productId      -> Product?   // прив'язка до товару
  categoryId     -> Category?  // прив'язка до категорії
  channels       Json          // ['telegram', 'viber', 'instagram']
  status         PublicationStatus
  scheduledAt    DateTime?
  publishedAt    DateTime?
  createdBy      -> User
  hashtags       String?
  firstComment   String?       // перший коментар для Instagram
  igMediaId      String?       // ID медіа в Instagram
  igPermalink    String?       // Permalink в Instagram
  igInsightsJson Json?         // Інсайти Instagram
  tgMessageId    BigInt?       // ID повідомлення в Telegram
  viberMsgToken  String?       // Token повідомлення Viber
  buttons        Json?         // Inline кнопки [{text, url}]
  templateType   String?       // Тип шаблону
  errorMessage   String?       // Текст помилки
  retryCount     Int           // Кількість спроб (default 0)
}
```

## CRUD операції

### Створення

**Endpoint:** `POST /api/v1/admin/publications`

```json
{
  "title": "Новинка сезону!",
  "content": "Представляємо новий засіб...",
  "imagePath": "/uploads/products/image.jpg",
  "productId": 42,
  "channels": ["telegram", "viber", "instagram"],
  "hashtags": "#cleanshop #new",
  "buttons": [{"text": "Купити", "url": "/product/slug"}],
  "scheduledAt": "2025-03-01T10:00:00Z"
}
```

Якщо `scheduledAt` вказано -- статус `scheduled`, інакше `draft`.

### Список

**Endpoint:** `GET /api/v1/admin/publications`

Параметри: `page`, `limit`, `status`.

Включає: автор (fullName), товар (name, slug).

### Оновлення

**Endpoint:** `PUT /api/v1/admin/publications/:id`

Доступні поля: title, content, imagePath, channels, hashtags, scheduledAt, status.

### Видалення

**Endpoint:** `DELETE /api/v1/admin/publications/:id`

Заборонено видаляти публікації зі статусом `published`.

## Публікація

### Негайна публікація

**Endpoint:** `POST /api/v1/admin/publications/:id/publish`

**Сервіс:** `publishNow(publicationId)`

### Процес публікації по каналах

#### Telegram

1. Перевірка наявності `TELEGRAM_CHANNEL_ID` та `TELEGRAM_BOT_TOKEN`
2. Відправка через `sendMessage` API:
   - Формат HTML: `<b>Title</b>\n\nContent\nHashtags`
   - Inline кнопки (якщо є)
3. Зберігає `tgMessageId`

#### Viber

1. Перевірка наявності `VIBER_AUTH_TOKEN`
2. Broadcast через `broadcast_message` API:
   - Текстовий формат: `Title\n\nContent`
3. Зберігає `viberMsgToken`

#### Instagram

1. Перевірка `INSTAGRAM_ACCESS_TOKEN` та `INSTAGRAM_BUSINESS_ACCOUNT_ID`
2. Формування caption: `Title\n\nContent\n\nHashtags`
3. Визначення типу медіа:
   - Відео (.mp4, .mov) -> Reels (`publishReelsPost`)
   - Зображення -> Image Post (`publishImagePost`)
4. Carousel якщо кілька зображень (`publishCarouselPost`)
5. Зберігає `igMediaId`, `igPermalink`
6. Публікація першого коментаря (`firstComment`) якщо вказано

### Оновлення статусу

Після успішної публікації: `status = 'published'`, `publishedAt = now()`.

## Планування (Scheduling)

Публікації зі статусом `scheduled` та `scheduledAt <= now()` обробляються cron-задачею:

1. Знаходить заплановані публікації
2. Викликає `publishNow()` для кожної
3. При помилці: збільшує `retryCount`, записує `errorMessage`
4. Якщо `retryCount >= maxRetries` -> `status = 'failed'`

## Retry-логіка

- Кожен канал публікується незалежно (помилка одного не блокує інші)
- Помилки логуються через `console.error`
- `retryCount` відстежує кількість спроб
- `errorMessage` зберігає текст останньої помилки

## Зображення публікацій

### Модель PublicationImage

```
PublicationImage {
  publicationId -> Publication
  imagePath     String
  imageUrl      String?
  sortOrder     Int
  altText       String?
  igMediaId     String?  // ID медіа в Instagram (для carousel)
  width         Int?
  height        Int?
  sizeBytes     Int?
}
```

Підтримує:
- Кілька зображень (carousel для Instagram)
- Відео файли (.mp4, .mov для Reels)
- Обкладинки для Reels

## Інсайти Instagram

Після публікації можна отримати інсайти:
- `getMediaInsights(mediaId)` -- impressions, reach, engagement, saved
- Зберігаються в `igInsightsJson`

## Файли модуля

- `src/services/publication.ts` -- CRUD та публікація
- `src/services/instagram.ts` -- Instagram Graph API
- `src/services/telegram.ts` -- Telegram Bot API (для каналу)
- `src/services/viber.ts` -- Viber API (broadcast)
- `src/app/api/v1/admin/publications/` -- ендпоінти
- `src/app/(admin)/admin/channels/page.tsx` -- UI адмін-панелі
