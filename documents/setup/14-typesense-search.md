# 14. Typesense — повнотекстовий пошук

## Що робить Typesense

Typesense — це швидкий пошуковий движок з відкритим кодом. Він індексує товари та забезпечує миттєвий пошук з:
- толерантністю до помилок (typo tolerance)
- фасетною фільтрацією (за ціною, категорією тощо)
- сортуванням за релевантністю
- підтримкою української мови

---

## Локальна розробка

Typesense вже налаштований у `docker-compose.yml` і стартує разом з іншими сервісами:

```bash
docker compose up -d
```

Typesense доступний на `http://localhost:8108`.

Перевірити здоров'я:

```bash
curl http://localhost:8108/health
# Очікуваний результат: {"ok":true}
```

---

## Продакшн: варіант 1 — свій сервер

### Крок 1: Встановити Typesense на VPS

```bash
# Ubuntu/Debian
curl -O https://dl.typesense.org/releases/27.1/typesense-server-27.1-amd64.deb
sudo dpkg -i typesense-server-27.1-amd64.deb
sudo systemctl enable typesense-server
sudo systemctl start typesense-server
```

### Крок 2: Згенерувати API-ключ

```bash
openssl rand -hex 32
```

Результат, наприклад: `a1b2c3d4e5f6...`

### Крок 3: Додати змінні до `.env`

```env
# Typesense
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_API_KEY=a1b2c3d4e5f6...ваш-згенерований-ключ
TYPESENSE_PROTOCOL=http
```

> Якщо Typesense стоїть на іншому сервері, вкажіть його IP або домен і використовуйте `TYPESENSE_PROTOCOL=https`.

---

## Продакшн: варіант 2 — Typesense Cloud

Якщо не хочете адмініструвати Typesense самостійно:

1. Зареєструйтесь на [cloud.typesense.org](https://cloud.typesense.org/)
2. Створіть кластер (є безкоштовний план)
3. Отримайте хост, порт і API-ключ з дашборду
4. Заповніть `.env`:

```env
TYPESENSE_HOST=xxx.typesense.net
TYPESENSE_PORT=443
TYPESENSE_API_KEY=ваш-cloud-api-key
TYPESENSE_PROTOCOL=https
```

---

## Індексація товарів

### Перша індексація (або переіндексація)

Викличте endpoint реіндексації:

```bash
curl -X POST http://localhost:3000/api/v1/cron/reindex-products \
  -H "Authorization: Bearer <ваш-cron-secret>"
```

Або через адмін-панель: **Налаштування → Пошук → Переіндексувати**.

### Автоматична індексація

Товари автоматично додаються/оновлюються в індексі при:
- створенні нового товару
- редагуванні товару
- зміні ціни або наявності

---

## Перевірка роботи

1. Відкрийте сайт і почніть вводити назву товару в пошуковий рядок.
2. Результати мають з'являтися **миттєво** (менше 50 мс).
3. Перевірте через API:

```bash
curl "http://localhost:8108/collections/products/documents/search?q=порошок&query_by=name" \
  -H "X-TYPESENSE-API-KEY: ваш-ключ" | jq
```

---

## Усунення проблем

| Проблема | Рішення |
|----------|---------|
| Пошук не повертає результатів | Виконайте переіндексацію через `/api/v1/cron/reindex-products` |
| `Connection refused` | Перевірте, що Typesense запущений: `systemctl status typesense-server` або `docker ps` |
| `Forbidden` (403) | Неправильний API-ключ. Перевірте `TYPESENSE_API_KEY` |
| Повільний пошук | Перевірте, що Typesense має достатньо RAM (мінімум 256 MB для невеликого каталогу) |
| Українські символи не знаходяться | Typesense підтримує Unicode автоматично. Перевірте, що `query_by` вказує на правильне поле |
