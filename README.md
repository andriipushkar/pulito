# Pulito

Гуртово-роздрібна e-commerce платформа (інтернет-магазин побутової хімії) на **Next.js 16** з multi-tenancy, SaaS-білінгом, B2B-ціноутворенням та 20+ зовнішніми інтеграціями.

## 📚 Документація

Повна документація проєкту — у теці **[`docs/`](docs/README.md)**:

| Розділ                                                                                                                           |                                        |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| [Огляд проєкту](docs/01-огляд-проєкту.md)                                                                                        | Призначення, бізнес-моделі, можливості |
| [Технології](docs/02-технології.md) · [Архітектура](docs/03-архітектура.md)                                                      | Стек і будова системи                  |
| [Встановлення](docs/04-встановлення.md) · [Конфігурація (ENV)](docs/05-конфігурація-env.md)                                      | Запуск та налаштування                 |
| [База даних](docs/06-база-даних.md)                                                                                              | Prisma-схема, моделі, enum             |
| [Магазин](docs/07-магазин.md) · [Кабінет](docs/08-особистий-кабінет.md) · [B2B](docs/09-b2b-гурт.md)                             | Функціонал вітрини                     |
| [Адмін-панель](docs/10-адмін-панель.md)                                                                                          | Усі сторінки адмінки                   |
| [Інтеграції](docs/11-інтеграції.md) · [Маркетплейси](docs/12-маркетплейси.md) · [Постачальники](docs/13-постачальники-імпорт.md) | Зовнішні сервіси                       |
| [REST API](docs/14-api.md) · [Безпека](docs/15-безпека.md)                                                                       | Для розробників                        |
| [SEO/маркетинг](docs/16-seo-маркетинг.md) · [Аналітика](docs/17-аналітика-звіти.md) · [Multi-tenancy](docs/18-multi-tenancy.md)  | Маркетинг і платформа                  |
| [Деплой](docs/19-деплой-операції.md) · [Тестування](docs/20-тестування.md)                                                       | Експлуатація                           |

👉 **Початок:** [docs/README.md](docs/README.md)

## ⚡ Швидкий старт

```bash
npm install
cp .env.example .env          # заповнити DATABASE_URL, REDIS_URL, APP_SECRET, JWT_SECRET
docker compose up -d          # PostgreSQL + PgBouncer + Redis + Typesense
npm run db:generate && npm run db:migrate && npm run db:seed
npm run dev                   # http://localhost:3000
```

Детально — [docs/04-встановлення.md](docs/04-встановлення.md).

## 🗂️ Структура репозиторію

```
docs/              — документація проєкту (20 розділів)
src/               — застосунок (Next.js); unit-тести лежать поряд: src/**/*.test.ts
src/test/          — спільна тест-інфраструктура (моки, setup, prisma-mock)
prisma/            — схема БД (22 файли) та міграції
tests/             — окремі набори тестів:
  ├─ integration/  — інтеграційні (Vitest, npm run test:integration)
  ├─ e2e/          — E2E (Playwright, npm run test:e2e)
  └─ load/         — навантажувальні (k6, npm run test:load)
scripts/           — допоміжні скрипти
business/          — матеріали для презентації/продажу платформи
```

> Unit-тести (~710) навмисно лежать поряд із кодом (`src/**/*.test.ts`) — це конвенція проєкту. У теці `tests/` зібрано лише окремі (standalone) набори.

## 📦 Основні скрипти

| Команда                                    | Опис                                 |
| ------------------------------------------ | ------------------------------------ |
| `npm run dev`                              | Dev-сервер                           |
| `npm run build` / `npm start`              | Production-білд / запуск             |
| `npm test`                                 | Unit/integration тести (Vitest)      |
| `npm run test:e2e`                         | E2E (Playwright)                     |
| `npm run test:integration`                 | Інтеграційні тести (Docker + Vitest) |
| `npm run db:migrate` / `npm run db:studio` | Prisma міграції / GUI                |
| `./deploy.sh`                              | Атомарний production-деплой          |

## 📄 Ліцензія

Proprietary. Див. [LICENSE](LICENSE).
