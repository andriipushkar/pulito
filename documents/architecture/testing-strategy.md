# Стратегія тестування

## Технологічний стек

- **Unit-тести:** Vitest (сумісний з Jest API)
- **E2E-тести:** Playwright (заплановано)
- **Мок-бібліотеки:** `vi.mock()`, `vi.fn()` (вбудовані в Vitest)

## Цільове покриття

| Модуль | Мінімальне покриття |
|--------|-------------------|
| Загальне покриття проекту | 70% |
| Auth (реєстрація, логін, токени, middleware) | 85% |
| Orders (створення, статуси, валідація) | 85% |
| Cart (серверний кошик, checkout) | 85% |
| Решта модулів | 70% |

## Структура тестових файлів

Тести розташовані поруч з вихідними файлами:
```
src/
  services/auth.ts
  services/auth.test.ts
  services/token.ts
  services/token.test.ts
  validators/auth.ts
  validators/auth.test.ts
  middleware/auth.test.ts
  app/api/v1/auth/login/route.ts
  app/api/v1/auth/login/route.test.ts
```

## Налаштування тестового середовища

### Файл `src/test/setup.ts`
Конфігурує змінні оточення перед кожним тестом:
```ts
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test');
  vi.stubEnv('REDIS_URL', 'redis://localhost:6380/0');
  vi.stubEnv('JWT_SECRET', 'test-jwt-secret-minimum-16-chars');
  vi.stubEnv('JWT_ACCESS_TTL', '15m');
  vi.stubEnv('JWT_REFRESH_TTL', '30d');
  vi.stubEnv('APP_URL', 'http://localhost:3000');
  vi.stubEnv('APP_SECRET', 'test-app-secret');
});
```

## Мок-паттерни

### Prisma Mock (`src/test/mocks/prisma.ts`)
Створює мок-об'єкт з усіма моделями Prisma:
```ts
export function createMockPrisma() {
  return {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
    product: { ... },
    category: { ... },
    refreshToken: { ... },
    auditLog: { ... },
  };
}
```

**Використання в тестах:**
```ts
vi.mock('@/lib/prisma', () => ({
  prisma: createMockPrisma(),
}));
```

### Redis Mock (`src/test/mocks/redis.ts`)
Мок Redis-клієнта:
```ts
export function createMockRedis() {
  return {
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    setex: vi.fn().mockResolvedValue('OK'),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(-1),
    keys: vi.fn().mockResolvedValue([]),
    quit: vi.fn().mockResolvedValue('OK'),
    status: 'ready',
  };
}
```

### Env Mock
Для тестів API routes та сервісів env мокається окремо:
```ts
vi.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-minimum-16-chars',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '30d',
  },
}));
```

### Service Mocks
Сервіси мокаються з `vi.mock()` та іменованими мок-функціями:
```ts
const mockLoginUser = vi.fn();
vi.mock('@/services/auth', () => ({
  loginUser: (...args: unknown[]) => mockLoginUser(...args),
}));
```

## Паттерни тестування API Routes

Тести для Next.js API routes створюють `NextRequest` об'єкти:
```ts
function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}
```

Перевіряють:
1. Успішний відгук (200/201) з правильними даними
2. Валідацію входу (422 для невалідних даних)
3. Бізнес-помилки (401, 403, 404, 409)
4. Внутрішні помилки (500)
5. Коректність cookie (Set-Cookie з refresh_token)

## Паттерни тестування Auth Middleware

```ts
describe('withAuth', () => {
  it('should call handler with user on valid token');
  it('should return 401 when no token provided');
  it('should return 401 for invalid token');
  it('should return 401 for blacklisted token');
});

describe('withRole', () => {
  it('should allow user with matching role');
  it('should allow user with one of multiple roles');
  it('should return 403 for user without required role');
});
```

## E2E тестування (Playwright)

Заплановані сценарії:
- Повний flow реєстрації та входу
- Перегляд каталогу та фільтрація
- Додавання товару до кошика та оформлення замовлення
- Адмін-панель: управління товарами та замовленнями
- Мобільна версія: адаптивність інтерфейсу

## Запуск тестів

```bash
# Unit-тести
npm run test

# З покриттям
npm run test:coverage

# Конкретний файл
npx vitest src/services/auth.test.ts

# В watch-режимі
npx vitest --watch
```
