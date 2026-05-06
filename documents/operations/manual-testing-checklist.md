# Чек-ліст ручного тестування перед релізом

Цей документ описує перевірки, які **не можна** зробити unit-тестами і які треба
проганяти руками на staging environment з реальними креденшалами/інтеграціями
перед кожним великим релізом.

Час повного прогону: ~30-45 хвилин.

## 1. Migrations on production-like data

**Чому**: prod БД має >1000 замовлень, edge-кейси типу NULL у нових колонках.

```bash
# Створи clone-копію prod-БД на staging
pg_dump $PROD_DB | psql $STAGING_DB

# Запусти всі міграції
DATABASE_URL=$STAGING_DB npx prisma migrate deploy

# Переконайся що нові колонки додано без помилок
psql $STAGING_DB -c "\d orders" | grep -E "company_name|edrpou|tracking_status|delivery_street_ref"

# Перевір що існуючі замовлення не зламались
psql $STAGING_DB -c "SELECT COUNT(*) FROM orders WHERE deleted_at IS NULL;"
```

**Очікуваний результат**: 4 нові колонки (`company_name`, `edrpou`, `tracking_status`,
`tracking_status_at`, `delivery_street_ref`, `delivery_building`, `delivery_flat`),
кількість замовлень не змінилась.

## 2. Live payment webhook ↔ reconciliation

**Чому**: cron може не спрацьовувати, якщо APP_SECRET не передається коректно.

### 2.1 Нормальний flow з webhook

1. На staging: оформи замовлення з `paymentMethod: 'online'`, провайдер LiqPay sandbox.
2. Сплати тестовою карткою.
3. **Очікувано**: webhook від LiqPay приходить → замовлення `paymentStatus: 'paid'`
   протягом 10 секунд.

### 2.2 Reconciliation коли webhook загублено

1. Оформи ще одне замовлення.
2. **Перед** оплатою — заблокуй webhook URL у firewall staging-серверу
   (наприклад через `iptables -A INPUT -p tcp --dport 3000 -m string --string "webhooks/liqpay" -j DROP`,
   або тимчасово видали роут).
3. Сплати картку.
4. Замовлення лишається в `paymentStatus: 'pending'` (бо webhook заблоковано).
5. Зачекай 30 хвилин (або викличи cron вручну):
   ```bash
   curl -X POST -H "Authorization: Bearer $APP_SECRET" \
     https://staging.pulito.trade/api/v1/cron/payment-reconciliation
   ```
6. **Очікувано**: replied JSON `{ checked: 1, resolved: 1 }`. Замовлення
   `paymentStatus: 'paid'`. Розблокуй webhook.

### 2.3 GitHub Actions cron schedule

1. Закомітити у staging-branch файл `.github/workflows/cron-payments-tracking.yml`.
2. Перейти у GitHub → Actions → "Cron — Payments & Tracking" → ручно запустити
   workflow_dispatch.
3. **Очікувано**: workflow зелений, у логах HTTP 200 для обох ендпоінтів.

## 3. remove.bg квота і fallback

**Чому**: коли квота вичерпана, поведінка має бути graceful — фото зберігається
без BG removal, але обробка не падає.

### 3.1 Happy path

1. В адмінці завантаж фото з кольоровим фоном (синій, червоний, тощо).
2. Чекбокс "Автоматично видалити фон" — увімкнено.
3. **Очікувано**: фото зберігається на нейтральному `#f5f5f5` фоні. Перевір
   у devtools що `pathFull` URL віддає коректний WebP.

### 3.2 Test 429 / quota exhausted

1. Тимчасово зашкодь API ключ у env: `REMOVEBG_API_KEY=invalid`.
2. Перезапусти сервер.
3. Завантаж фото з активним чекбоксом BG removal.
4. **Очікувано**: фото зберігається БЕЗ removal — на оригінальному фоні з
   доданим padding'ям до квадрата. У логах: `warn  remove.bg API failed status=403`.
5. Поверни валідний ключ.

### 3.3 Bulk + BG removal stress

1. Підготуй 10 фото різних розмірів (квадрат / горизонтал / вертикал, 600-2000 px).
2. Завантаж усі за раз через `<input multiple>`.
3. **Очікувано**: усі 10 збережені, час обробки <55 сек (під timeout 60s).
   Якщо більше — BG removal вимкнути для bulk.
4. Якщо одне фало не пройшло (помилка remove.bg) — інші 9 збережені, у відповіді
   `{ ok: [...9 items], failed: [...1 item] }`.

## 4. Bulk TTN creation

**Чому**: real-world scenario для менеджера, який щодня обробляє 50+ замовлень.

1. На staging — переконайся що 5 замовлень мають `deliveryMethod: 'nova_poshta'`,
   `deliveryWarehouseRef` заповнено, `trackingNumber: null`, `status: 'confirmed'`.
2. Зайди в `/admin/orders`.
3. Постав чекбокси на ці 5 замовлень.
4. Натисни "Створити ТТН (НП)".
5. **Очікувано**: toast "Створено 5 ТТН", замовлення оновились — у кожного
   з'явився `trackingNumber`. У NP кабінеті — 5 нових накладних.
6. Спробуй ще раз з тими ж замовленнями — toast "Не створено 5: TTN вже існує".
7. Тест коли частина даних відсутня: один замовлення без `deliveryWarehouseRef`,
   інші ОК. Очікувано — частковий успіх з failed-списком у toast.

## 5. NP D2D — кур'єрська доставка з автокомплітом вулиць

**Чому**: новий complex flow, у unit тестах перевіряється тільки contract.

1. Зайди на `/checkout` як клієнт, обери Нову Пошту.
2. У picker натисни "Адресна (кур'єр)".
3. Введи "Київ" → обери зі списку.
4. У полі "Вулиця" введи "Хрещ" → переконайся що випадає список вулиць (Хрещатик,
   Хрещата і т.д.).
5. Обери "Хрещатик".
6. Вкажи будинок "1", квартиру "5".
7. Заверши оформлення.
8. На admin-стороні переведи статус → `confirmed`.
9. **Очікувано**: TTN автоматично створюється з `serviceType: 'WarehouseDoors'`,
   `RecipientStreet`/`RecipientHouse`/`RecipientFlat` заповнено правильними значеннями.
   Перевір у NP кабінеті — накладна виглядає як кур'єрська на адресу.

## 6. B2B рахунок-фактура auto-email

1. Оформи замовлення вказавши `companyName: 'ТОВ Тест'` і `edrpou: '12345678'`
   (поля з'являються коли клієнт натискає "Я представник юридичної особи").
2. Email — твоя робоча пошта.
3. Переведи статус → `confirmed` через адмінку.
4. **Очікувано**: за 5-10 секунд приходить email з темою "Рахунок-фактура за
   замовленням #..." і PDF-вкладенням. Відкрий PDF — переконайся що блоки
   "Постачальник" і "Покупець (юридична особа)" заповнені реквізитами.
5. **XSS-test**: Завантаж замовлення з `companyName: '<script>alert(1)</script>'`
   через прямий API виклик або HTML form bypass:
   ```bash
   curl -X POST https://staging/api/v1/orders \
     -H "Cookie: ..." \
     -d '{"contactName":"Test","contactEmail":"you@example.com","contactPhone":"+380501112233","deliveryMethod":"pickup","paymentMethod":"cod","companyName":"<script>alert(1)</script>","edrpou":"12345678",...}'
   ```
   Переведи в confirmed → отримай email → переконайся що `<script>` не виконується
   у клієнті, замість нього `&lt;script&gt;`.

## 7. Address book autofill

1. Залогінся як клієнт з 3+ попередніми замовленнями (різні міста, різні методи).
2. Перейди на `/checkout`, дійди до кроку "Доставка".
3. **Очікувано**: над формою — секція "Збережені адреси з минулих замовлень"
   з 3-5 кнопками-пресетами.
4. Натисни на пресет → форма заповнюється автоматично (місто, відділення/адреса).
5. **Edge-case**: вимкни в admin-settings метод НП. Залогінся як клієнт зі
   старими НП-замовленнями. Очікувано — у пресетах НП-адрес немає (бо НП недоступна).

## 8. Free delivery threshold display

1. У `/admin/delivery-settings` встанови `Безкоштовна доставка від: 1500 грн`.
2. Залогінься як клієнт, додай товарів на 800 грн у кошик.
3. **Очікувано**: на сторінці `/cart` під рядком "Доставка" — прогрес-бар
   ~53% і текст "Додайте ще 700 ₴ для безкоштовної доставки".
4. Додай ще на 700+ грн → прогрес-бар повний зелений + текст "Безкоштовна
   доставка вам нараховується".

## 9. Pickup info display

1. У `/admin/delivery-settings` встанови `delivery_pickup_address`,
   `delivery_pickup_hours`, `delivery_pickup_phone`.
2. Як клієнт на `/checkout` обери "Самовивіз".
3. **Очікувано**: під radio-вибором з'являється сірий блок з адресою/годинами/телефоном
   складу.

## 10. Auto-tracking status у клієнтському кабінеті

1. Створи замовлення з ТТН (через bulk-ttn або auto-create).
2. Викличи cron вручну:
   ```bash
   curl -X POST -H "Authorization: Bearer $APP_SECRET" \
     https://staging/api/v1/cron/auto-tracking
   ```
3. У БД: переконайся що `orders.tracking_status` і `tracking_status_at` оновились.
4. Залогінься як клієнт → `/account/orders/<id>` → блок "Доставка" має показувати
   статус ("Прибуло у відділення", "В дорозі" тощо) з timestamp оновлення.

## 11. Performance smoke test

Перевір що нічого не deg/regressed з основних шляхів:

| Сторінка          | Очікувана LCP |
| ----------------- | ------------- |
| `/` (головна)     | <2.5s         |
| `/catalog`        | <2.5s         |
| `/product/<slug>` | <2.0s         |
| `/checkout`       | <3.0s         |

Запусти Lighthouse → перевір SEO score >85 (після змін з opengraph-image, canonical).

## Що робити коли тест провалився

1. **Не релізити** — записати у incident-log хто, коли, що зламалось.
2. **Перевірити changelog** з останнього релізу — звузити до конкретного коміту.
3. **Переключити фічу-флаг** якщо є (наприклад, BG removal — просто вимкнути
   `REMOVEBG_API_KEY=`).
4. **Виправляти на гілці**, повторити чек-ліст від відповідного пункту.

## Schedule запусків

- **Перед кожним релізом на prod** — повний прогон.
- **Раз на тиждень на staging** — частковий прогон (#1, #2.1, #4, #6).
- **Після зміни payment/delivery провайдера** — повний пункт #2 і #5.
- **Після зміни image/upload коду** — пункт #3.
