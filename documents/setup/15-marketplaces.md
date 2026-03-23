# 15. Маркетплейси (OLX, Rozetka, Prom, Epicentr)

Інтеграція дозволяє автоматично вивантажувати товари на маркетплейси та синхронізувати ціни, залишки й замовлення.

---

## OLX

### Крок 1: Зареєструвати партнерський акаунт

1. Перейдіть на [partners.olx.ua](https://partners.olx.ua/)
2. Подайте заявку на підключення API
3. Після схвалення отримайте `Client ID` та `Client Secret`
4. Авторизуйтесь через OAuth2 і отримайте `Access Token` та `Refresh Token`

### Крок 2: Додати змінні до `.env`

```env
# OLX
OLX_CLIENT_ID=ваш-client-id
OLX_CLIENT_SECRET=ваш-client-secret
OLX_ACCESS_TOKEN=ваш-access-token
OLX_REFRESH_TOKEN=ваш-refresh-token
```

### Крок 3: Налаштувати в адмінці

Перейдіть у **Адмін-панель → Маркетплейси → OLX** і:
- Увімкніть інтеграцію
- Оберіть категорії товарів для вивантаження
- Налаштуйте маппінг категорій OLX

### API URL

```
https://www.olx.ua/api/partner/
```

### Перевірка

```bash
curl -H "Authorization: Bearer $OLX_ACCESS_TOKEN" \
  https://www.olx.ua/api/partner/adverts
```

---

## Rozetka (Seller API)

### Крок 1: Зареєструватися як продавець

1. Перейдіть на [seller.rozetka.com.ua](https://seller.rozetka.com.ua/)
2. Заповніть заявку та пройдіть верифікацію
3. В особистому кабінеті отримайте `API Key` та `Seller ID`

### Крок 2: Додати змінні до `.env`

```env
# Rozetka
ROZETKA_API_KEY=ваш-api-key
ROZETKA_SELLER_ID=ваш-seller-id
```

### Крок 3: Налаштувати в адмінці

Перейдіть у **Адмін-панель → Маркетплейси → Rozetka** і:
- Увімкніть інтеграцію
- Вкажіть API Key та Seller ID
- Налаштуйте маппінг категорій

### API URL

```
https://api-seller.rozetka.com.ua/
```

### Перевірка

```bash
curl -H "Authorization: Bearer $ROZETKA_API_KEY" \
  https://api-seller.rozetka.com.ua/sites
```

---

## Prom.ua

### Крок 1: Зареєструватися

1. Створіть магазин на [prom.ua](https://prom.ua/)
2. Перейдіть у **Налаштування → API**
3. Згенеруйте API-токен

### Крок 2: Додати змінні до `.env`

```env
# Prom.ua
PROM_API_TOKEN=ваш-api-token
```

### Крок 3: Налаштувати в адмінці

Перейдіть у **Адмін-панель → Маркетплейси → Prom.ua** і:
- Увімкніть інтеграцію
- Вкажіть API Token
- Оберіть товари для вивантаження

### API URL

```
https://my.prom.ua/api/v1/
```

### Перевірка

```bash
curl -H "Authorization: Bearer $PROM_API_TOKEN" \
  https://my.prom.ua/api/v1/products/list
```

---

## Epicentr K

### Крок 1: Зареєструватися як продавець

1. Перейдіть на [marketplace.epicentrk.ua](https://marketplace.epicentrk.ua/)
2. Подайте заявку та пройдіть верифікацію
3. Отримайте `API Key` та `Seller ID` в кабінеті продавця

### Крок 2: Додати змінні до `.env`

```env
# Epicentr K
EPICENTR_API_KEY=ваш-api-key
EPICENTR_SELLER_ID=ваш-seller-id
```

### Крок 3: Налаштувати в адмінці

Перейдіть у **Адмін-панель → Маркетплейси → Epicentr** і:
- Увімкніть інтеграцію
- Вкажіть API Key та Seller ID
- Налаштуйте маппінг категорій Epicentr

### API URL

```
https://api.epicentrk.ua/marketplace/
```

### Перевірка

```bash
curl -H "Authorization: $EPICENTR_API_KEY" \
  https://api.epicentrk.ua/marketplace/products
```

---

## Синхронізація цін і залишків (cron)

Автоматична синхронізація працює через cron-завдання. Ціни та залишки оновлюються на всіх підключених маркетплейсах.

Розклад за замовчуванням:
- **Ціни та залишки:** кожні 30 хвилин
- **Нові товари:** раз на годину
- **Замовлення:** кожні 15 хвилин

Перевірити стан синхронізації:

```bash
curl http://localhost:3000/api/v1/cron/marketplace-sync \
  -H "Authorization: Bearer <ваш-cron-secret>"
```

Або в **Адмін-панель → Маркетплейси → Лог синхронізації**.

---

## Усунення проблем

| Проблема | Рішення |
|----------|---------|
| Товари не з'являються на маркетплейсі | Перевірте маппінг категорій. Маркетплейси відхиляють товари без категорії. |
| `401 Unauthorized` | Перевірте, що токен актуальний. OLX-токен потрібно оновлювати через refresh. |
| Ціни не синхронізуються | Перевірте лог cron-завдань в адмін-панелі. |
| Дублікати товарів | Перевірте, що артикул (SKU) унікальний для кожного товару. |
