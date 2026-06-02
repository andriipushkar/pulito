# Налаштування оплати (Payment Setup)

Операційний гайд із підключення платіжних систем у Pulito.

## Де налаштовувати

Адмінка → **Налаштування оплати** (`/admin/payment-settings`).

Усі ключі зберігаються **зашифрованими** в базі (AES-256-GCM). **env-fallback немає** — ключі живуть лише в адмін-панелі. Кожна картка провайдера має згорнутий блок «Як підключити» з посиланнями на кабінет і документацію.

## Спільне для всіх

- `APP_URL` у проді = `https://pulito.trade` (не `localhost`) — впливає на result/redirect URL і підпис домену WayForPay.
- Сайт має працювати по HTTPS.
- Послідовність: `npm run build` → ввести ключі в адмінці → `pm2 restart pulito`.
- Після введення ключів: **Зберегти** → **Перевірити підключення** (має бути зелено) → увімкнути тумблер провайдера.
- Перевірка робить реальний запит до провайдера (підпис/токен), а не лише валідацію формату.

---

## LiqPay

- Кабінет: https://www.liqpay.ua/
- Документація: https://www.liqpay.ua/en/documentation/api/home
- Apple Pay (doc): https://www.liqpay.ua/en/doc/api/internet_acquiring/apay
- Webhook (Server URL): `https://pulito.trade/api/webhooks/liqpay`

```
КАБІНЕТ LiqPay:
□ Зареєструвати магазин, довести до статусу «Активний» (верифікація ПриватБанку)
  ⚠️ до активації оплата проходить, але кошти НЕ зараховуються
□ Скопіювати Public Key і Private Key
□ Метод Apple Pay → «Підключити»
□ Server URL = https://pulito.trade/api/webhooks/liqpay

АДМІНКА:
□ Вставити Public Key + Private Key
□ Вимкнути тумблер «Тестовий режим» (для реальних платежів)
□ Зберегти → Перевірити підключення → зелено
□ Увімкнути тумблер LiqPay
□ (опц.) Оплата частинами + кількість місяців
□ Увімкнути Apple Pay / Google Pay
```

---

## Monobank

- Кабінет (Еквайринг): https://web.monobank.ua/
- Документація: https://api.monobank.ua/docs/acquiring.html
- Webhook: налаштовується **автоматично** нашим кодом при створенні інвойсу — вручну нічого не вписувати.

```
КАБІНЕТ Monobank:
□ Створити токен інтернет-еквайрингу

АДМІНКА:
□ Вставити Token
□ Зберегти → Перевірити підключення (покаже назву мерчанта) → зелено
□ Увімкнути тумблер Monobank
```

---

## WayForPay

- Кабінет: https://m.wayforpay.com/
- Документація: https://wiki.wayforpay.com/
- Apple Pay (doc): https://help.wayforpay.com/uk/apple-pay
- Webhook (Service URL): `https://pulito.trade/api/webhooks/wayforpay`

```
КАБІНЕТ WayForPay:
□ Скопіювати Merchant Account + Secret Key
□ Перевірити, що домен мерчанта = pulito.trade
□ «Платіжні методи»: увімкнути Apple Pay і Google Pay
□ Service URL = https://pulito.trade/api/webhooks/wayforpay

АДМІНКА:
□ Вставити Merchant Account + Secret Key
□ Зберегти → Перевірити підключення → зелено
□ Увімкнути тумблер WayForPay
□ Увімкнути Apple Pay / Google Pay
```

---

## Apple Pay / Google Pay

- **Окремих ключів не потрібно** — оплата йде через налаштований WayForPay або LiqPay.
- **Верифікація домену / файл `apple-developer-merchantid-domain-association` НЕ потрібні** — використовується сторінка оплати провайдера (його домен уже верифікований Apple).
- Apple Pay вмикається в кабінеті провайдера (LiqPay: «Підключити»; WayForPay: «Платіжні методи»).
- Кнопка з'являється лише на підтримуваних пристроях:
  - **Apple Pay** — Safari/iPhone з карткою у Wallet;
  - **Google Pay** — Chrome/Android з прив'язаною карткою.
- На десктоп-Windows у Chrome кнопок не буде — це очікувано.

---

## Офлайн-методи (без ключів)

```
□ Накладений платіж (COD) — просто увімкнути тумблер
□ Банківський переказ — увімкнути + вписати реквізити (IBAN)
□ Передоплата на картку — увімкнути + вписати номер картки
```

---

## Перевірка після деплою

```
□ APP_URL = https://pulito.trade
□ Оформити тестове замовлення кожним методом
□ Apple Pay — перевірити з iPhone/Safari; Google Pay — з Android/Chrome
□ Переконатись, що після оплати статус замовлення став «оплачено» (= webhook працює)
```

_Останнє оновлення: 2026-05-30 (env-fallback прибрано; ключі лише в адмінці; додано інструкції з підключення та Apple/Google Pay)._
