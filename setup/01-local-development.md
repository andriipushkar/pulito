# Локальна розробка

Покрокова інструкція для запуску проєкту Clean Shop на вашому комп'ютері.

## Передумови

| Інструмент | Версія | Перевірка |
|------------|--------|-----------|
| Node.js | >= 20 LTS | `node -v` |
| npm | >= 10 | `npm -v` |
| Docker + Docker Compose | latest | `docker compose version` |
| Git | >= 2.30 | `git --version` |

### Встановлення Node.js 20

```bash
# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# macOS (Homebrew)
brew install node@20

# Або через nvm (рекомендовано)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install 20
nvm use 20
```

### Встановлення Docker

```bash
# Ubuntu
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
# Перезайдіть у сесію після цієї команди

# macOS — завантажте Docker Desktop з https://docker.com
```

## Крок 1 — Клонувати репозиторій

```bash
git clone <URL-репозиторію> clean-shop
cd clean-shop
```

## Крок 2 — Встановити залежності

```bash
npm install
```

## Крок 3 — Запустити інфраструктуру (Docker)

Docker Compose піднімає PostgreSQL, PgBouncer, Redis та Typesense:

```bash
# Створіть .env з паролями для Docker
export POSTGRES_PASSWORD=clean_pass
export TYPESENSE_API_KEY=xyz123
export APP_SECRET=$(openssl rand -hex 32)
export JWT_SECRET=$(openssl rand -hex 32)

# Запустіть сервіси
docker compose up -d
```

Перевірте, що все працює:

```bash
docker compose ps
```

Очікуваний результат — всі сервіси в статусі `healthy`:
- `clean_postgres` — PostgreSQL 16 (порт 5432, внутрішній)
- `clean_pgbouncer` — PgBouncer (порт 6432)
- `clean_redis` — Redis 7 (порт 6380 на хості → 6379 в контейнері)
- `clean_typesense` — Typesense 27 (порт 8108)

## Крок 4 — Налаштувати змінні середовища

```bash
cp .env.example .env
```

Відкрийте `.env` і заповніть основні змінні:

```env
# Залиште як є для локальної розробки
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# БД — для локальної розробки через Docker
DATABASE_URL=postgresql://clean_user:clean_pass@localhost:5432/clean_shop?schema=public

# Redis — порт 6380 на хості (Docker маппінг 6380:6379)
REDIS_URL=redis://localhost:6380/0

# Секрети — згенеруйте випадкові
JWT_SECRET=<вставте-результат: openssl rand -hex 32>
APP_SECRET=<вставте-результат: openssl rand -hex 32>

# Email — для тестування можна залишити порожнім або використати Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@localhost
```

> **Примітка:** Решта змінних (Telegram, LiqPay, Нова Пошта тощо) — опціональні для локальної розробки. Налаштуйте їх пізніше за потреби.

## Крок 5 — Підготувати базу даних

```bash
# Згенерувати Prisma Client
npm run db:generate

# Запустити міграції
npm run db:migrate

# Наповнити базу тестовими даними (опціонально)
npm run db:seed
```

## Крок 6 — Запустити dev-сервер

```bash
npm run dev
```

Відкрийте браузер: **http://localhost:3000**

## Корисні команди

```bash
# Зупинити Docker-сервіси
docker compose down

# Зупинити і видалити всі дані (volumes)
docker compose down -v

# Переглянути логи конкретного сервісу
docker compose logs -f postgres
docker compose logs -f redis

# Скинути БД повністю
npm run db:reset

# Перевірити статус міграцій
npx prisma migrate status

# Відкрити Prisma Studio (GUI для БД)
npx prisma studio
```

## Типові проблеми та рішення

### Порт 5432 вже зайнятий

Якщо на машині вже запущений PostgreSQL:

```bash
# Варіант 1: Зупинити локальний PostgreSQL
sudo systemctl stop postgresql

# Варіант 2: Змінити порт в docker-compose.yml
# postgres → ports: '5433:5432'
# Та оновити DATABASE_URL в .env
```

### Порт 6380 зайнятий (Redis)

```bash
# Перевірити, хто використовує порт
sudo lsof -i :6380

# Зупинити локальний Redis або змінити порт
```

### Docker compose не знаходить змінні

Переконайтеся, що POSTGRES_PASSWORD і TYPESENSE_API_KEY задані:

```bash
# Створіть .env в корені (Docker Compose читає його автоматично)
echo "POSTGRES_PASSWORD=clean_pass" >> .env
echo "TYPESENSE_API_KEY=xyz123" >> .env
```

### Помилка `P1001: Can't reach database server`

```bash
# Перевірте, що контейнери запущені
docker compose ps

# Перевірте, що PostgreSQL готовий
docker compose exec postgres pg_isready

# Перевірте URL підключення в .env
# Для прямого підключення (без PgBouncer): localhost:5432
# Через PgBouncer: localhost:6432
```

### Помилка при `npm run db:migrate`

```bash
# Очистіть кеш Prisma
rm -rf node_modules/.prisma
npm run db:generate

# Якщо помилка зберігається — скиньте БД
npm run db:reset
```

### `next: command not found`

```bash
# Перевстановіть залежності
rm -rf node_modules
npm install
```

### Помилка з пам'яттю при білді

```bash
# Збільшіть ліміт пам'яті для Node.js
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```
