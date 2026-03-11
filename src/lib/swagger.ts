/**
 * OpenAPI 3.0 base document for Clean Shop API.
 * Used by the /api-docs endpoint and generate-openapi script.
 *
 * Uses Zod 4 built-in z.toJSONSchema() to auto-generate request body schemas
 * from the same validators used at runtime.
 */

import { z } from 'zod';
import { registerSchema, loginSchema } from '@/validators/auth';
import { checkoutSchema, updateOrderStatusSchema } from '@/validators/order';
import { initiatePaymentSchema } from '@/validators/payment';
import { calculatePalletCostSchema, palletConfigSchema } from '@/validators/pallet-delivery';
import { adjustPointsSchema } from '@/validators/loyalty';

/** Convert a Zod schema to an OpenAPI-compatible JSON Schema object. */
function zodSchema(schema: z.ZodType): object {
  return z.toJSONSchema(schema, { unrepresentable: 'any', io: 'input' });
}

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Порошок API',
    description: 'REST API для інтернет-магазину побутової хімії (оптово-роздрібна платформа)',
    version: '1.0.0',
    contact: {
      name: 'Порошок',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http' as const,
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' },
        },
      },
      Success: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
        },
      },
      Paginated: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'array', items: {} },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
              totalPages: { type: 'integer' },
            },
          },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          slug: { type: 'string' },
          code: { type: 'string' },
          priceRetail: { type: 'number' },
          priceWholesale: { type: 'number', nullable: true },
          priceWholesale2: { type: 'number', nullable: true },
          priceWholesale3: { type: 'number', nullable: true },
          quantity: { type: 'integer' },
          isActive: { type: 'boolean' },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          orderNumber: { type: 'string' },
          status: { type: 'string', enum: ['new_order', 'processing', 'confirmed', 'paid', 'shipped', 'completed', 'cancelled', 'returned'] },
          totalAmount: { type: 'number' },
          paymentMethod: { type: 'string', enum: ['cod', 'bank_transfer', 'online', 'card_prepay'] },
          deliveryMethod: { type: 'string', enum: ['nova_poshta', 'ukrposhta', 'pickup', 'pallet'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          email: { type: 'string' },
          fullName: { type: 'string', nullable: true },
          role: { type: 'string', enum: ['user', 'manager', 'admin'] },
          clientType: { type: 'string', enum: ['retail', 'wholesale'] },
        },
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          slug: { type: 'string' },
          parentId: { type: 'integer', nullable: true },
        },
      },
      AuthTokens: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
        },
      },
    },
  },
  paths: {
    // Auth
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Реєстрація',
        requestBody: {
          content: { 'application/json': { schema: zodSchema(registerSchema) } },
        },
        responses: {
          '201': { description: 'Користувача створено' },
          '400': { description: 'Невірні дані' },
          '409': { description: 'Email вже використовується' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Логін',
        requestBody: {
          content: { 'application/json': { schema: zodSchema(loginSchema) } },
        },
        responses: {
          '200': { description: 'Успішний логін', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthTokens' } } } },
          '401': { description: 'Невірні облікові дані' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Оновити токен',
        responses: {
          '200': { description: 'Нові токени' },
          '401': { description: 'Невалідний refresh token' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Вихід',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Успішний вихід' } },
      },
    },

    // Products
    '/products': {
      get: {
        tags: ['Products'],
        summary: 'Список товарів',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'categoryId', in: 'query', schema: { type: 'integer' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['name', 'price', 'newest'] } },
        ],
        responses: {
          '200': { description: 'Список товарів з пагінацією' },
        },
      },
    },
    '/products/{slug}': {
      get: {
        tags: ['Products'],
        summary: 'Товар за slug',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Деталі товару' },
          '404': { description: 'Товар не знайдено' },
        },
      },
    },

    // Cart
    '/cart': {
      get: {
        tags: ['Cart'],
        summary: 'Кошик поточного користувача',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Вміст кошика' } },
      },
    },
    '/cart/items': {
      post: {
        tags: ['Cart'],
        summary: 'Додати товар у кошик',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['productId'],
                properties: {
                  productId: { type: 'integer' },
                  quantity: { type: 'integer', default: 1 },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Товар додано' } },
      },
    },

    // Orders
    '/orders': {
      get: {
        tags: ['Orders'],
        summary: 'Замовлення поточного користувача',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'Список замовлень' } },
      },
      post: {
        tags: ['Orders'],
        summary: 'Створити замовлення (checkout)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: { 'application/json': { schema: zodSchema(checkoutSchema) } },
        },
        responses: {
          '201': { description: 'Замовлення створено' },
          '400': { description: 'Невірні дані або порожній кошик' },
        },
      },
    },
    '/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Деталі замовлення',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': { description: 'Деталі замовлення' },
          '404': { description: 'Замовлення не знайдено' },
        },
      },
    },
    '/orders/{id}/pay': {
      post: {
        tags: ['Orders', 'Payments'],
        summary: 'Ініціювати оплату замовлення',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: { 'application/json': { schema: zodSchema(initiatePaymentSchema) } },
        },
        responses: {
          '200': { description: 'URL для оплати', content: { 'application/json': { schema: { type: 'object', properties: { redirectUrl: { type: 'string' } } } } } },
        },
      },
    },

    // Webhooks
    '/webhooks/liqpay': {
      post: { tags: ['Webhooks'], summary: 'LiqPay callback', responses: { '200': { description: 'OK' } } },
    },
    '/webhooks/monobank': {
      post: { tags: ['Webhooks'], summary: 'Monobank callback', responses: { '200': { description: 'OK' } } },
    },

    // User profile
    '/me': {
      get: {
        tags: ['Profile'],
        summary: 'Профіль поточного користувача',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Дані профілю' } },
      },
    },
    '/me/referral': {
      get: {
        tags: ['Profile', 'Referrals'],
        summary: 'Реферальна інформація',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Реферальний код, посилання, статистика' } },
      },
    },
    '/me/loyalty': {
      get: {
        tags: ['Profile', 'Loyalty'],
        summary: 'Лояльність — дашборд',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Баланс балів, рівень, транзакції' } },
      },
    },
    '/me/loyalty/transactions': {
      get: {
        tags: ['Profile', 'Loyalty'],
        summary: 'Історія транзакцій лояльності',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { '200': { description: 'Пагінований список транзакцій' } },
      },
    },

    // Delivery
    '/delivery/tracking': {
      get: {
        tags: ['Delivery'],
        summary: 'Трекінг посилки',
        parameters: [
          { name: 'trackingNumber', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'provider', in: 'query', required: true, schema: { type: 'string', enum: ['nova_poshta', 'ukrposhta'] } },
        ],
        responses: { '200': { description: 'Статус посилки' } },
      },
    },
    '/delivery/pallet/calculate': {
      post: {
        tags: ['Delivery'],
        summary: 'Розрахунок вартості палетної доставки',
        requestBody: {
          content: { 'application/json': { schema: zodSchema(calculatePalletCostSchema) } },
        },
        responses: { '200': { description: 'Вартість доставки' } },
      },
    },

    // Metrics
    '/metrics': {
      post: {
        tags: ['Metrics'],
        summary: 'Відправити Web Vitals метрики',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  value: { type: 'number' },
                  route: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'OK' } },
      },
    },

    // Admin — Orders
    '/admin/orders': {
      get: {
        tags: ['Admin'],
        summary: 'Список всіх замовлень',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'dateFrom', in: 'query', schema: { type: 'string' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Пагінований список замовлень' } },
      },
    },
    '/admin/orders/{id}/status': {
      put: {
        tags: ['Admin'],
        summary: 'Оновити статус замовлення',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: { 'application/json': { schema: zodSchema(updateOrderStatusSchema) } },
        },
        responses: { '200': { description: 'Статус оновлено' } },
      },
    },

    // Admin — Analytics
    '/admin/analytics': {
      get: {
        tags: ['Admin', 'Analytics'],
        summary: 'Аналітика',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'type', in: 'query', required: true, schema: { type: 'string', enum: ['sales', 'products', 'clients', 'orders'] } },
          { name: 'days', in: 'query', schema: { type: 'integer', default: 30 } },
        ],
        responses: { '200': { description: 'Дані аналітики залежно від типу' } },
      },
    },
    '/admin/analytics/performance': {
      get: { tags: ['Admin', 'Analytics'], summary: 'Performance метрики', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Web Vitals агреговані дані' } } },
    },
    '/admin/analytics/funnel': {
      get: { tags: ['Admin', 'Analytics'], summary: 'Воронка конверсії', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Дані воронки' } } },
    },
    '/admin/analytics/cohorts': {
      get: { tags: ['Admin', 'Analytics'], summary: 'Когортний аналіз', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Retention когорт' } } },
    },
    '/admin/analytics/abc': {
      get: { tags: ['Admin', 'Analytics'], summary: 'ABC-аналіз товарів', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Класифікація товарів' } } },
    },

    // Admin — Personal Prices
    '/admin/personal-prices': {
      get: {
        tags: ['Admin'],
        summary: 'Список персональних цін',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Пагінований список' } },
      },
      post: {
        tags: ['Admin'],
        summary: 'Створити персональну ціну',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Створено' } },
      },
    },

    // Admin — Referrals
    '/admin/referrals': {
      get: {
        tags: ['Admin', 'Referrals'],
        summary: 'Список рефералів',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Пагінований список' } },
      },
    },

    // Admin — Loyalty
    '/admin/loyalty/settings': {
      get: { tags: ['Admin', 'Loyalty'], summary: 'Налаштування рівнів лояльності', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Список рівнів' } } },
      put: { tags: ['Admin', 'Loyalty'], summary: 'Оновити рівні лояльності', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Оновлено' } } },
    },
    '/admin/loyalty/adjust': {
      post: {
        tags: ['Admin', 'Loyalty'],
        summary: 'Ручне нарахування/списання балів',
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: zodSchema(adjustPointsSchema) } } },
        responses: { '200': { description: 'Баланс оновлено' } },
      },
    },

    // Admin — Settings
    '/admin/settings': {
      get: { tags: ['Admin'], summary: 'Налаштування сайту', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Key-value налаштувань' } } },
      put: { tags: ['Admin'], summary: 'Оновити налаштування', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Оновлено' } } },
    },
    '/admin/settings/pallet-delivery': {
      get: { tags: ['Admin', 'Delivery'], summary: 'Конфіг палетної доставки', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Конфіг' } } },
      put: {
        tags: ['Admin', 'Delivery'],
        summary: 'Оновити конфіг палетної доставки',
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: zodSchema(palletConfigSchema.partial()) } } },
        responses: { '200': { description: 'Оновлено' } },
      },
    },
  },
  tags: [
    { name: 'Auth', description: 'Авторизація і реєстрація' },
    { name: 'Products', description: 'Каталог товарів' },
    { name: 'Cart', description: 'Кошик' },
    { name: 'Orders', description: 'Замовлення' },
    { name: 'Payments', description: 'Онлайн-оплата' },
    { name: 'Webhooks', description: 'Webhook від платіжних систем' },
    { name: 'Profile', description: 'Профіль користувача' },
    { name: 'Referrals', description: 'Реферальна програма' },
    { name: 'Loyalty', description: 'Програма лояльності' },
    { name: 'Delivery', description: 'Доставка та трекінг' },
    { name: 'Metrics', description: 'Web Vitals метрики' },
    { name: 'Analytics', description: 'Аналітика' },
    { name: 'Admin', description: 'Адміністрування' },
  ],
};
