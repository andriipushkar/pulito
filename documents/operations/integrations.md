# Зовнішні інтеграції

## Telegram Bot

### Змінні оточення
| Змінна | Опис |
|--------|------|
| `TELEGRAM_BOT_TOKEN` | Токен бота від @BotFather |
| `TELEGRAM_MANAGER_CHAT_ID` | Chat ID менеджера для сповіщень |

### Webhook
**Endpoint:** `POST /api/v1/webhooks/telegram`

Обробляє `TelegramUpdate`: повідомлення, callback_query, inline_query.

### Функціональність
- **Головне меню:** Каталог, Акції, Замовлення, Контакти, Налаштування
- **Команди:** `/start`, `/catalog`, `/promo`, `/orders`, `/search <запит>`, `/contact`, `/help`, `/link`, `/prices`
- **Пошук товарів:** будь-який текст довжиною >= 2 символи інтерпретується як пошуковий запит
- **Inline Query:** пошук товарів з результатами прямо в чаті
- **Оптові ціни:** `/prices` для авторизованих оптовиків
- **Прив'язка акаунту:** `/link` генерує одноразовий токен (TTL 10 хв), зберігається в Redis під ключем `tg_link:<token>`
- **Розклад роботи:** налаштовується через `SiteSetting` з ключем `bot_schedule`

### Сповіщення менеджерам
- Нове замовлення: `notifyManagerNewOrder()`
- Зворотний зв'язок: `notifyManagerFeedback()`

### Сповіщення клієнтам
- Зміна статусу замовлення: `notifyClientStatusChange()` -- через `telegramChatId` в User
- Загальні сповіщення: `sendClientNotification(chatId, title, message, link)`

### Налаштування webhook
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/api/v1/webhooks/telegram"}'
```

---

## Viber Bot

### Змінні оточення
| Змінна | Опис |
|--------|------|
| `VIBER_AUTH_TOKEN` | Auth Token від Viber Partner Account |

### Webhook
**Endpoint:** `POST /api/v1/webhooks/viber`

Обробляє Viber-події: `subscribed`, `message`.

### Функціональність
- **Головне меню (keyboard):** Каталог, Акції, Замовлення, Інфо, Обране, Меню
- **Rich Media Carousel:** каруселі товарів з зображеннями
- **Пагінація каталогу:** стан сторінки зберігається в Redis (`viber:catalog_page:<userId>`)
- **Відстеження замовлень:** `/track ORDER_NUMBER`
- **Прив'язка акаунту:** `/link email@example.com` -> 6-значний код -> верифікація
- **Списки бажань:** перегляд обраного для прив'язаних акаунтів

### Підпис безпеки
`verifyViberSignature(body, signature)` -- HMAC-SHA256 з VIBER_AUTH_TOKEN.

### Сповіщення
`sendViberNotification(userId, title, message, link)` -- надсилає текстове повідомлення через `viberUserId` в User.

### Налаштування webhook
```bash
curl -X POST "https://chatapi.viber.com/pa/set_webhook" \
  -H "Content-Type: application/json" \
  -H "X-Viber-Auth-Token: <TOKEN>" \
  -d '{"url": "https://your-domain.com/api/v1/webhooks/viber", "event_types": ["subscribed", "message"]}'
```

---

## Instagram (Graph API v21.0)

### Змінні оточення
| Змінна | Опис |
|--------|------|
| `INSTAGRAM_ACCESS_TOKEN` | Long-lived access token |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | ID бізнес-акаунту Instagram |
| `INSTAGRAM_APP_ID` | ID додатку Facebook |
| `INSTAGRAM_APP_SECRET` | Секрет додатку Facebook |

### Публікації
Підтримує три типи медіа:

1. **Image Post:** `publishImagePost(imageUrl, caption)` -- одне зображення з підписом
2. **Carousel:** `publishCarouselPost(imageUrls, caption)` -- 2-10 зображень
3. **Reels:** `publishReelsPost(videoUrl, caption, coverUrl?)` -- відео з обкладинкою, polling статусу обробки (до 30 спроб з інтервалом 5 сек)

### First Comment
`postFirstComment(mediaId, comment)` -- додає перший коментар до публікації (використовується для хештегів).

### Аналітика
- `getAccountInsights()` -- impressions, reach, profileViews, followerCount
- `getMediaInsights(mediaId)` -- impressions, reach, engagement, saved

### Retry-логіка
Всі запити до Graph API використовують `fetchWithRetry()`:
- Максимум 3 спроби
- Exponential backoff (1s, 2s, 4s)
- Обробка rate limiting (HTTP 429) через заголовок `retry-after`

---

## Нова Пошта

### Змінні оточення
| Змінна | Опис |
|--------|------|
| `NOVA_POSHTA_API_KEY` | API-ключ від Нової Пошти |

### API URL
`https://api.novaposhta.ua/v2.0/json/`

### Функції
- `searchCities(query)` -- пошук міст (Address.searchSettlements)
- `getWarehouses(cityRef, search?)` -- список відділень (Address.getWarehouses)
- `trackParcel(ttn)` -- відстеження за номером ТТН (TrackingDocument.getStatusDocuments)
- `estimateDeliveryCost(input)` -- розрахунок вартості (InternetDocument.getDocumentPrice)
- `createInternetDocument(input)` -- створення ТТН (InternetDocument.save)

### Endpoints
- `GET /api/v1/nova-poshta/cities?q=<query>` -- пошук міст
- `GET /api/v1/nova-poshta/warehouses?cityRef=<ref>&q=<search>` -- пошук відділень
- `POST /api/v1/nova-poshta/estimate` -- розрахунок доставки
- `GET /api/v1/nova-poshta/track/:ttn` -- відстеження

---

## Укрпошта

### Змінні оточення
| Змінна | Опис |
|--------|------|
| `UKRPOSHTA_BEARER_TOKEN` | Bearer-токен API Укрпошти |

---

## Email (SMTP)

### Змінні оточення
| Змінна | Опис | За замовчуванням |
|--------|------|-----------------|
| `SMTP_HOST` | SMTP-сервер | `smtp.gmail.com` |
| `SMTP_PORT` | Порт (587 для TLS, 465 для SSL) | `587` |
| `SMTP_USER` | Email логін | |
| `SMTP_PASS` | Пароль або App Password | |
| `SMTP_FROM` | Відправник | `noreply@localhost` |

### Транспорт
Nodemailer з автоматичним визначенням secure (порт 465 = SSL).

### Retry-логіка
До 3 спроб з exponential backoff (1s, 2s, 4s).

### Типи листів
- Підтвердження email: `sendVerificationEmail(email, token)`
- Відновлення пароля: `sendPasswordResetEmail(email, token)`
- Сповіщення (через notification-queue): довільний HTML

### Шаблони email
Зберігаються в базі (`EmailTemplate`) з версіонуванням (`EmailTemplateVersion`).

---

## Web Push (PWA)

### Змінні оточення
| Змінна | Опис |
|--------|------|
| `VAPID_PUBLIC_KEY` | VAPID публічний ключ |
| `VAPID_PRIVATE_KEY` | VAPID приватний ключ |
| `VAPID_EMAIL` | Контактний email для VAPID (за замовчуванням `mailto:noreply@clean-shop.ua`) |

### Функції
- `subscribePush(userId, subscription)` -- збереження підписки (endpoint, p256dh, auth)
- `unsubscribePush(endpoint)` -- видалення підписки
- `sendPushNotification(userId, payload)` -- надсилання конкретному користувачу
- `sendPushToAll(payload)` -- масова розсилка (батчами по 50)
- `getVapidPublicKey()` -- повертає публічний ключ для клієнта

### Payload формат
```json
{
  "title": "Заголовок",
  "body": "Текст повідомлення",
  "url": "/path",
  "icon": "/icons/icon-192x192.png"
}
```

Автоматичне очищення невалідних підписок (HTTP 410).

---

## Платіжні провайдери

### LiqPay
| Змінна | Опис |
|--------|------|
| `LIQPAY_PUBLIC_KEY` | Публічний ключ LiqPay |
| `LIQPAY_PRIVATE_KEY` | Приватний ключ LiqPay |

**Webhook:** `POST /api/webhooks/liqpay`

### Monobank
| Змінна | Опис |
|--------|------|
| `MONOBANK_TOKEN` | Токен API Monobank |

**Webhook:** `POST /api/webhooks/monobank`

---

## Google OAuth

### Змінні оточення
| Змінна | Опис |
|--------|------|
| `GOOGLE_CLIENT_ID` | Client ID з Google Console |
| `GOOGLE_CLIENT_SECRET` | Client Secret |
