# Налаштування платіжних систем

Clean Shop підтримує **три базові провайдери** (LiqPay, Monobank, WayForPay) і **три додаткові методи**, що роутяться через них:

- **LiqPay "Оплата частинами" від ПриватБанку** — через LiqPay (`paytypes='paypart'`)
- **Apple Pay** — через WayForPay (preferred) або LiqPay
- **Google Pay** — через WayForPay (preferred) або LiqPay

Усі ключі **опційні** — без них фіча просто не показується в чекауті. Можна задавати через `.env` або через адмін-панель `/admin/payment-settings` (DB має пріоритет над env).

## LiqPay

### Крок 1 — Реєстрація

1. Перейдіть на **https://www.liqpay.ua/uk**
2. Натисніть **Зареєструватись**
3. Зареєструйтесь через номер телефону (потрібна ПриватБанк картка)
4. Підтвердіть email

### Крок 2 — Отримати ключі

1. Увійдіть у **https://www.liqpay.ua/uk/adminbusiness**
2. Перейдіть у **API** → **Ключі API**
3. Скопіюйте:
   - **Public Key** — публічний ключ (sandbox\_ або ваш бізнес-ключ)
   - **Private Key** — приватний ключ

> Для тестування використовуйте **sandbox-ключі** (вкладка "Тестовий режим").

### Крок 3 — Налаштувати Webhook

1. У кабінеті LiqPay → **API** → **Налаштування**
2. Вкажіть **Server-Server URL**:

```
https://yourdomain.com/api/webhooks/liqpay
```

### Крок 4 — Додати в .env (або в адмінку)

```env
LIQPAY_PUBLIC_KEY=sandbox_XXXXXXXXX
LIQPAY_PRIVATE_KEY=sandbox_XXXXXXXXXXXXXXXXXXXXXXXXX
```

Альтернатива: відкрий `/admin/payment-settings` і впиши ключі прямо в адмінці — DB має пріоритет над env, перезапуск не потрібен.

### Крок 4.1 — Sandbox toggle

Замість окремих sandbox-ключів LiqPay використовує параметр `sandbox=1`. Вмикається через адмінку:

1. `/admin/payment-settings` → жовта секція **"LiqPay Sandbox-режим"** → toggle ON
2. Зберегти

При наступному запиті оплати LiqPay-сервіс автоматично додає `sandbox: 1`. Гроші не списуються, всі дії проходять через тестовий процесинг.

> **Важливо**: перед launch — обов'язково вимкнути sandbox toggle в адмінці.

### Крок 4.2 — "Оплата частинами" від ПриватБанку

LiqPay підтримує розстрочку через `paytypes='paypart'`. Окремих ключів не потрібно — використовує ті самі LiqPay credentials.

1. `/admin/payment-settings` → секція **"ПриватБанк — Оплата частинами"** → toggle ON
2. Поле **"Кількість місяців розстрочки"** — від 2 до 24 (default 3 або 6)
3. Зберегти

В чекауті з'явиться окремий радіо-варіант "ПриватБанк — Оплата частинами" поряд з LiqPay. Комісія за розстрочку платить мерчант (поточно ~3-5%).

### Крок 5 — Тестування

Використовуйте тестову картку:

| Параметр     | Значення               |
| ------------ | ---------------------- |
| Номер картки | `4242 4242 4242 4242`  |
| Термін дії   | Будь-яка майбутня дата |
| CVV          | `123`                  |

1. Створіть замовлення на сайті
2. Оберіть оплату LiqPay
3. Введіть тестову картку
4. Оплата має пройти успішно
5. Webhook має оновити статус замовлення

### Перехід у Production

1. У кабінеті LiqPay підключіть реальний мерчант-акаунт
2. Замініть sandbox-ключі на production-ключі в .env:

```env
LIQPAY_PUBLIC_KEY=i_XXXXXXXXX
LIQPAY_PRIVATE_KEY=XXXXXXXXXXXXXXXXXXXXXXXXX
```

3. Перезапустіть додаток

---

## Monobank Acquiring

### Крок 1 — Реєстрація

1. Перейдіть на **https://api.monobank.ua/**
2. Для отримання токену еквайрингу зверніться через **Monobank для бізнесу**: https://www.monobank.ua/business
3. Після підключення інтернет-еквайрингу ви отримаєте **X-Token**

> Для тестування можна отримати тестовий токен через підтримку Monobank.

### Крок 2 — Додати в .env

```env
MONOBANK_TOKEN=uXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### Крок 3 — Webhook

Webhook URL для Monobank налаштовується програмно при створенні інвойсу. Додаток автоматично вказує:

```
https://yourdomain.com/api/webhooks/monobank
```

### Крок 4 — Тестування

1. Створіть замовлення на сайті
2. Оберіть оплату Monobank
3. Використайте тестову картку Monobank (якщо доступна)
4. Перевірте, що статус замовлення оновився

---

## WayForPay

### Крок 1 — Реєстрація

1. Перейдіть на **https://wayforpay.com/**
2. Натисніть **Зареєструватись**
3. Заповніть форму реєстрації мерчанта
4. Підтвердіть email та пройдіть верифікацію

### Крок 2 — Отримати ключі

1. Увійдіть у **Особистий кабінет** → **Налаштування магазину**
2. Знайдіть:
   - **Merchant Account** — ідентифікатор мерчанта
   - **Secret Key** — секретний ключ для підпису запитів

### Крок 3 — Налаштувати Webhook

1. У кабінеті WayForPay → **Налаштування магазину** → **URL для відповідей**
2. Вкажіть:

```
https://yourdomain.com/api/webhooks/wayforpay
```

### Крок 4 — Додати в .env

```env
WAYFORPAY_MERCHANT_ACCOUNT=your_merchant_account
WAYFORPAY_SECRET_KEY=your_secret_key
```

### Крок 5 — Тестування

WayForPay надає тестовий режим:

1. У кабінеті активуйте **Тестовий режим**
2. Використайте тестові картки з документації WayForPay
3. Створіть замовлення та оплатіть
4. Перевірте webhook та оновлення статусу

### Перехід у Production

1. Пройдіть модерацію магазину в WayForPay
2. Вимкніть тестовий режим у кабінеті
3. Production-ключі залишаються тими ж

---

## Apple Pay та Google Pay

Окремих API-ключів **не потрібно** — використовують WFP або LiqPay як базовий gateway. Достатньо мати один з них налаштованим.

### Крок 1 — Налаштувати базовий gateway

Краще використати **WayForPay** (preferred routing):

- Відкрий заявку на Apple Pay merchant у кабінеті WFP — потребує домен
- Завантаж файл domain validation за шляхом `/.well-known/apple-developer-merchantid-domain-association` на сайт
- Підтверди домен у Apple Developer console (якщо є)

LiqPay також підтримує — fallback роутинг автоматичний.

### Крок 2 — Активувати в адмінці

1. `/admin/payment-settings` → секція **"Apple Pay та Google Pay"**
2. Toggle Apple Pay → ON
3. Toggle Google Pay → ON
4. Зберегти

### Крок 3 — Як це працює для клієнта

1. Клієнт обирає в чекауті "Онлайн-оплата" → бачить серед провайдерів **Apple Pay** і **Google Pay** (з чорними іконками / G на топі списку)
2. Натискає → редірект на сторінку обраного gateway (WFP або LiqPay)
3. На сторінці gateway бачить **тільки** кнопку Apple/Google Pay (інші методи приховані через `paymentSystems` filter)
4. Клац → Touch ID / Face ID / Google Account → готово

> **Без файлу domain validation** Apple Pay не з'явиться на сторінці провайдера. Це Apple-вимога, не наша.

> Для **нативної кнопки прямо на чекауті** (без редіректу) — окрема задача: підключити WayForPay Widget JS. Поточна реалізація використовує redirect-flow.

---

## Reconciliation (catching missed webhooks)

Webhook'и іноді губляться (network blip, firewall, провайдер repush'ить пізно). Без reconciliation замовлення зависає в `pending` назавжди.

### Як працює

Cron `/api/v1/cron/payment-reconciliation` запускається **кожні 15 хвилин** через GitHub Actions:

1. Шукає Payment-записи з `paymentStatus='pending'`, старші 30 хв і молодші 14 днів
2. Для кожного — викликає `checkPaymentStatus` / `checkInvoiceStatus` / `checkTransactionStatus` у відповідного провайдера
3. Якщо провайдер відповідає `success` або `failure` — зам'юкає той самий `handlePaymentCallback`, що webhook
4. Замовлення переводиться в `paid` (або `failed`) автоматично

### Налаштування GitHub Actions

Workflow вже існує: `.github/workflows/cron-payments-tracking.yml`. Треба додати **GitHub Secrets**:

- `PRODUCTION_URL` — наприклад `https://shop.example.com`
- `APP_SECRET` — той самий, що в `.env`

Після цього Actions сам викликатиме endpoint щочверть години.

### Альтернативи (якщо не використовуєш GH Actions)

Будь-який external cron може викликати endpoint:

```bash
curl -X POST -H "Authorization: Bearer $APP_SECRET" \
  https://shop.example.com/api/v1/cron/payment-reconciliation
```

Mockі для self-hosted серверів — `crontab -e`:

```
*/15 * * * * curl -sfX POST -H "Authorization: Bearer YOUR-SECRET" https://shop.example.com/api/v1/cron/payment-reconciliation
```

---

## Min online amount

В адмінці `/admin/payment-settings` є поле **"Мінімальна сума для онлайн-оплати"**. Якщо задано (`payment_min_online_amount > 0`):

- На чекауті — **онлайн-провайдери ховаються**, якщо `cartTotal < min`
- Клієнт бачить попередження "Онлайн-оплата доступна для замовлень від X грн"
- Доступні залишаються `cod`, `bank_transfer`, `card_prepay`

Корисно коли провайдер має комісію + fixed-fee, який роз'їдає прибуток на дрібних замовленнях.

---

## "Pay later" з кабінету клієнта

Якщо клієнт оформив замовлення з `paymentMethod='online'` і `paymentStatus='pending'` (наприклад, не дочекався webhook'у або закрив сторінку), він може **повторно ініціювати оплату** з кабінету:

- Перейти на `/account/orders/<id>` — побачить кнопки "Сплатити LiqPay / Monobank / WayForPay"
- Клік → `/api/v1/orders/<id>/pay` → редірект на gateway
- Можна спробувати інший провайдер, ніж оригінальний

---

## Загальні рекомендації

### Перевірка webhook-доставки

```bash
# Перегляньте логи додатку на предмет webhook-запитів
pm2 logs clean-shop | grep webhook
```

### Безпека

- **Ніколи** не зберігайте приватні ключі в коді або Git
- Використовуйте різні ключі для development та production
- Перевіряйте підписи webhook-запитів (додаток робить це автоматично)

### Тестовий чеклист

Для кожного провайдера перевірте:

- [ ] Створення платежу — перенаправлення на сторінку оплати
- [ ] Успішна оплата — webhook оновлює статус замовлення на "Оплачено"
- [ ] Невдала оплата — статус залишається "Очікує оплати"
- [ ] Повернення коштів (refund) — через адмін-панель
