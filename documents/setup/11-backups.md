# Резервне копіювання (Backups)

## PostgreSQL — автоматичне резервне копіювання

### Автоматичний бекап (cron)

Бекап запускається щоночі о 3:00 через cron-задачу:

```bash
0 3 * * * curl -s -X POST -H "Authorization: Bearer $APP_SECRET" http://localhost:3000/api/v1/cron/db-backup
```

Додатково, налаштуйте прямий pg_dump як запасний варіант:

```bash
# Додайте в crontab
crontab -e
```

```bash
# Бекап PostgreSQL щодня о 3:30
30 3 * * * docker compose -f /var/www/clean-shop/docker-compose.yml exec -T postgres pg_dump -U clean_user clean_shop | gzip > /backups/db/clean_shop_$(date +\%Y\%m\%d).sql.gz

# Видалити бекапи старше 30 днів
0 4 * * * find /backups/db -name "*.sql.gz" -mtime +30 -delete
```

### Підготувати директорію для бекапів

```bash
sudo mkdir -p /backups/db
sudo mkdir -p /backups/uploads
sudo chown -R deploy:deploy /backups
```

### Ручний бекап

```bash
# Через Docker
docker compose exec -T postgres pg_dump -U clean_user clean_shop > backup_$(date +%Y%m%d_%H%M%S).sql

# Або з стисненням
docker compose exec -T postgres pg_dump -U clean_user clean_shop | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Без Docker (якщо PostgreSQL встановлений локально)
pg_dump -U clean_user -h localhost clean_shop > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## Відновлення з бекапу

### Відновлення в поточну базу

```bash
# Зі звичайного SQL-файлу
docker compose exec -T postgres psql -U clean_user clean_shop < backup_20260319_030000.sql

# З gzip-файлу
gunzip -c backup_20260319.sql.gz | docker compose exec -T postgres psql -U clean_user clean_shop
```

### Відновлення в тимчасову базу (для перевірки)

```bash
# Створіть тимчасову базу
docker compose exec postgres createdb -U clean_user clean_shop_test

# Відновіть у тимчасову базу
docker compose exec -T postgres psql -U clean_user clean_shop_test < backup.sql

# Перевірте дані
docker compose exec postgres psql -U clean_user clean_shop_test -c "SELECT count(*) FROM products;"
docker compose exec postgres psql -U clean_user clean_shop_test -c "SELECT count(*) FROM orders;"

# Видаліть тимчасову базу
docker compose exec postgres dropdb -U clean_user clean_shop_test
```

---

## Бекап завантажених файлів

Директорія `uploads/` містить зображення товарів та інші файли.

### Локальне копіювання

```bash
rsync -avz /var/www/clean-shop/uploads/ /backups/uploads/
```

### Копіювання на віддалений сервер

```bash
# На інший VPS
rsync -avz -e ssh /var/www/clean-shop/uploads/ user@backup-server:/backups/clean-shop/uploads/

# Або на S3-сумісне сховище (якщо налаштовано R2/S3)
# Файли вже зберігаються в Cloudflare R2 (якщо налаштовано)
```

### Автоматичне копіювання (cron)

```bash
# Додайте в crontab
0 4 * * * rsync -avz /var/www/clean-shop/uploads/ /backups/uploads/
```

---

## Redis — без бекапу

Redis використовується для:
- Кешування (products, categories)
- Сесій
- Rate limiting

Всі дані **ефемерні** і відновлюються автоматично:
- Кеш — перестворюється при запитах
- Сесії — користувачі просто заново ввійдуть

> Redis НЕ потребує резервного копіювання.

---

## Перевірка бекапів

**Важливо:** Бекап без перевірки — не бекап.

### Щомісячна перевірка (рекомендовано)

1. Скопіюйте останній бекап:

```bash
cp /backups/db/clean_shop_$(date +%Y%m%d).sql.gz /tmp/test_backup.sql.gz
```

2. Відновіть у тимчасову базу:

```bash
docker compose exec postgres createdb -U clean_user clean_shop_verify
gunzip -c /tmp/test_backup.sql.gz | docker compose exec -T postgres psql -U clean_user clean_shop_verify
```

3. Перевірте кількість записів:

```bash
docker compose exec postgres psql -U clean_user clean_shop_verify -c "
  SELECT 'products' as table_name, count(*) FROM products
  UNION ALL
  SELECT 'orders', count(*) FROM orders
  UNION ALL
  SELECT 'users', count(*) FROM users;
"
```

4. Видаліть тимчасову базу:

```bash
docker compose exec postgres dropdb -U clean_user clean_shop_verify
rm /tmp/test_backup.sql.gz
```

---

## Політика зберігання

| Тип | Частота | Зберігання |
|-----|---------|-----------|
| Щоденний бекап БД | Кожну ніч о 3:00 | 30 днів |
| Бекап uploads | Кожну ніч о 4:00 | Безстроково (rsync — інкрементальний) |
| Ручний бекап | Перед оновленнями | За потреби |

### Автоматичне видалення старих бекапів

Вже налаштовано в crontab:

```bash
0 4 * * * find /backups/db -name "*.sql.gz" -mtime +30 -delete
```

Ця команда видаляє SQL-бекапи старше 30 днів.

---

## Рекомендації

1. **Перед кожним оновленням** — зробіть ручний бекап
2. **Зберігайте бекапи на іншому сервері** — не тільки локально
3. **Перевіряйте бекапи щомісяця** — відновіть у тестову базу
4. **Моніторте розмір бекапів** — якщо різко зменшився, можливо, дані втрачено

```bash
# Перевірити розмір бекапів
ls -lh /backups/db/
du -sh /backups/
```
