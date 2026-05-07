# Pulito — Module Documentation

## Architecture Overview

Pulito is built with **Next.js 16** (App Router) using a layered architecture:

```
┌──────────────────────────────────────────┐
│  Frontend (React 19 + Tailwind CSS 4)    │
│  ├── (shop) — Public storefront          │
│  ├── (admin) — Admin dashboard           │
│  └── (auth) — Auth pages                 │
├──────────────────────────────────────────┤
│  API Layer (Next.js Route Handlers)      │
│  └── /api/v1/* — RESTful endpoints       │
├──────────────────────────────────────────┤
│  Middleware (auth.ts)                     │
│  ├── withAuth() — JWT verification       │
│  └── withRole() — Role-based access      │
├──────────────────────────────────────────┤
│  Services Layer (Business Logic)         │
│  ├── auth, order, product, cart...       │
│  ├── payment, loyalty, referral...       │
│  └── analytics, performance...           │
├──────────────────────────────────────────┤
│  Data Layer                              │
│  ├── Prisma ORM → PostgreSQL             │
│  ├── Redis (ioredis) — Caching           │
│  └── BullMQ — Background jobs            │
└──────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── (shop)/             # Public storefront (catalog, cart, checkout, account)
│   ├── (admin)/            # Admin panel (orders, products, analytics, settings)
│   ├── (auth)/             # Login, register, password reset
│   ├── api/
│   │   ├── v1/             # Versioned REST API
│   │   └── webhooks/       # Payment provider webhooks
│   └── api-docs/           # Swagger UI
├── components/
│   ├── ui/                 # Reusable UI primitives (Button, Input, Spinner, Modal)
│   ├── layout/             # Header, Footer, TopBar, Sidebar, LanguageSwitcher
│   ├── checkout/           # Checkout step components
│   ├── admin/              # Admin-specific components
│   └── common/             # Shared components (WebVitalsReporter)
├── config/
│   └── env.ts              # Zod-validated environment configuration
├── i18n/                   # Internationalization (next-intl)
│   ├── routing.ts          # Locale routing config
│   ├── request.ts          # Server-side locale resolver
│   └── navigation.ts       # Client navigation helpers
├── lib/
│   ├── prisma.ts           # Prisma client singleton
│   ├── redis.ts            # Redis client + cache TTL constants
│   ├── api-client.ts       # Frontend API helper (fetch wrapper)
│   └── swagger.ts          # OpenAPI 3.0 document
├── messages/               # i18n translation files
│   ├── uk.json             # Ukrainian (default)
│   └── en.json             # English
├── middleware/
│   └── auth.ts             # withAuth(), withRole() decorators
├── services/               # Business logic layer
│   ├── auth.ts             # Registration, login, JWT tokens
│   ├── product.ts          # Product CRUD, search, filters
│   ├── category.ts         # Category tree
│   ├── cart.ts             # Cart operations
│   ├── order.ts            # Order creation, status management
│   ├── payment.ts          # Payment orchestration
│   ├── payment-providers/
│   │   ├── liqpay.ts       # LiqPay Checkout API
│   │   └── monobank.ts     # Monobank Acquiring API
│   ├── loyalty.ts          # Loyalty program (points, levels)
│   ├── referral.ts         # Referral system
│   ├── personal-price.ts   # Per-user pricing
│   ├── analytics.ts        # Funnel, cohorts, ABC analysis
│   ├── performance.ts      # Web Vitals aggregation
│   ├── pallet-delivery.ts  # Pallet delivery config & pricing
│   ├── nova-poshta.ts      # Nova Poshta API client
│   ├── ukrposhta.ts        # Ukrposhta tracking API
│   ├── email.ts            # Email sending (nodemailer)
│   └── jobs/               # BullMQ background jobs
│       └── performance-aggregate.ts
├── types/                  # TypeScript type definitions
│   ├── order.ts            # Order types, status labels, colors
│   ├── payment.ts          # Payment provider interfaces
│   ├── personal-price.ts
│   ├── referral.ts
│   └── loyalty.ts
├── utils/
│   └── api-response.ts     # successResponse(), errorResponse(), paginatedResponse()
└── validators/             # Zod validation schemas
    ├── auth.ts
    ├── order.ts
    ├── payment.ts
    ├── personal-price.ts
    ├── referral.ts
    ├── loyalty.ts
    └── pallet-delivery.ts
```

## Services Reference

### auth.ts

- `registerUser(data)` — Create user, hash password, generate referral code, send verification email
- `loginUser(email, password)` — Verify credentials, return JWT token pair
- `refreshTokens(refreshToken)` — Rotate refresh token, return new pair
- `logoutUser(accessToken, refreshToken)` — Blacklist both tokens in Redis

### order.ts

- `createOrder(userId, data)` — Validate cart, apply pricing rules, create order with items
- `getOrderById(id, userId?)` — Fetch order with items and status history
- `getUserOrders(userId, filters)` — Paginated order list
- `updateOrderStatus(orderId, newStatus, comment, source)` — Status transition with validation matrix
- Status transitions: `new_order → processing → confirmed → paid → shipped → completed`
- On `completed`: earn loyalty points, update referral status
- On `cancelled/returned`: deduct loyalty points

### payment.ts

- `initiatePayment(orderId, provider, userId)` — Create payment record, call provider, return redirect URL
- `handlePaymentCallback(provider, data)` — Verify signature, update payment & order status
- `getPaymentStatus(orderId)` — Check current payment state

### payment-providers/liqpay.ts

- `createPayment(params)` — Build base64 data + HMAC-SHA1 signature, return checkout URL
- `verifyCallback(data, signature)` — Verify SHA1 signature, decode and return payment data
- Signature: `SHA1(privateKey + base64(data) + privateKey)`

### payment-providers/monobank.ts

- `createPayment(params)` — POST to `api.monobank.ua/api/merchant/invoice/create` with X-Token
- `verifyCallback(body, xSign)` — ECDSA verification using Monobank public key (cached)
- Amounts in kopecks (UAH × 100), currency code 980

### loyalty.ts

- `getOrCreateLoyaltyAccount(userId)` — Find or create loyalty account
- `earnPoints(userId, orderId, orderAmount)` — Calculate points with level multiplier
- `spendPoints(userId, points, orderId)` — Deduct points (validates balance)
- `adjustPoints(userId, type, points, description)` — Manual add/deduct (admin)
- `recalculateLevel(userId)` — Update level based on totalSpent
- `getLoyaltyDashboard(userId)` — Account, level, recent transactions
- `getLoyaltyLevels()` / `updateLoyaltySettings(levels)` — CRUD loyalty levels

### referral.ts

- `generateReferralCode()` — Random hex code via `crypto.randomBytes`
- `processReferral(referredUserId, code)` — Create referral record
- `getUserReferralStats(userId)` — Code, link, referred count, completed count
- `grantReferralBonus(referralId, type, value)` — Mark referral as rewarded
- `getAllReferrals(filters)` — Admin list with pagination

### personal-price.ts

- `getPersonalPrices(filters)` — List with pagination, user/product/category filters
- `createPersonalPrice(data, createdBy)` — Create (productId OR categoryId, discountPercent OR fixedPrice)
- `updatePersonalPrice(id, data)` / `deletePersonalPrice(id)` — CRUD
- `getEffectivePrice(userId, productId, categoryId)` — Product-specific takes priority over category

### analytics.ts

- `getConversionFunnel(days)` — Aggregate DailyFunnelStats: pageViews → productViews → addToCart → cartViews → checkout → orders
- `getCohortAnalysis(months)` — Group users by registration month, calculate monthly retention %
- `getABCAnalysis(days)` — Classify products by revenue: A (80%), B (15%), C (5%)

### performance.ts

- `recordMetric(name, value, route)` — Store in Redis sorted set
- `aggregateDailyMetrics()` — Calculate p50/p75/p90, upsert to PerformanceMetric table
- `getAggregatedMetrics(days, route?)` — Query aggregated metrics for dashboard

### pallet-delivery.ts

- `getPalletConfig()` — Read from SiteSetting (JSON), fallback to defaults
- `updatePalletConfig(config, updatedBy)` — Upsert SiteSetting
- `calculatePalletDeliveryCost(weightKg, region)` — `(basePrice + weight × pricePerKg) × regionMultiplier`
- `validatePalletOrder(totalWeightKg, region)` — Check weight limits and region support

### nova-poshta.ts

- `searchCities(query)` — Nova Poshta Address API
- `searchWarehouses(cityRef, query)` — Warehouse search
- `trackParcel(trackingNumber)` — Tracking status

### ukrposhta.ts

- `trackParcel(barcode)` — Ukrposhta StatusTracking API with Bearer token

## Database Models

### Core Models

- **User** — email, password, role (user/manager/admin), clientType (retail/wholesale), referralCode
- **Product** — name, slug, code, prices (retail/wholesale), quantity, SEO fields
- **Category** — hierarchical (parentId), name, slug, images
- **Order** — orderNumber, status, amounts, contact info, delivery/payment details
- **OrderItem** — product snapshot (price at order time), quantity, subtotal
- **OrderStatusHistory** — audit trail for status changes

### Payment Models

- **Payment** — orderId, amount, status, method, provider (liqpay/monobank), callbackData

### Loyalty Models

- **LoyaltyAccount** — userId (unique), points, totalSpent, level
- **LoyaltyTransaction** — type (earn/spend/manual), points, orderId, description
- **LoyaltyLevel** — name, minSpent threshold, pointsMultiplier, discountPercent

### Referral Models

- **Referral** — referrerId, referredId, status (pending/completed/rewarded), bonusType, bonusValue

### Personal Pricing

- **PersonalPrice** — userId, productId/categoryId, discountPercent/fixedPrice, date range

### Analytics Models

- **DailyFunnelStats** — date, pageViews, productViews, addToCartCount, etc.
- **PerformanceMetric** — date, route, metric (LCP/CLS/FID/TTFB/INP), p50/p75/p90

### Infrastructure

- **SiteSetting** — key/value store for site configuration
- **Cart** / **CartItem** — user shopping cart
- **ProductImage** — multiple images per product
- **PriceHistory** — product price change log

## Authentication Flow

1. **Register**: POST `/api/v1/auth/register` → user created, verification email sent
2. **Login**: POST `/api/v1/auth/login` → JWT access token (15min) + refresh token (30d) in httpOnly cookie
3. **API Calls**: `Authorization: Bearer <accessToken>`
4. **Refresh**: POST `/api/v1/auth/refresh` → new token pair (old refresh token blacklisted)
5. **Logout**: POST `/api/v1/auth/logout` → both tokens blacklisted in Redis

### Middleware Decorators

```typescript
// Any authenticated user
export const GET = withAuth(async (request) => { ... });

// Admin or manager only
export const GET = withRole('admin', 'manager')(async (request) => { ... });
```

## Payment Webhooks

### LiqPay (`POST /api/webhooks/liqpay`)

- Content-Type: `application/x-www-form-urlencoded`
- Fields: `data` (base64 JSON) + `signature` (SHA1)
- Verification: `SHA1(privateKey + data + privateKey) === signature`
- Status mapping: `success/sandbox` → paid, `failure/error` → failed

### Monobank (`POST /api/webhooks/monobank`)

- Content-Type: `application/json`
- Header: `X-Sign` (base64 ECDSA signature)
- Verification: ECDSA with Monobank public key (`GET /api/merchant/pubkey`)
- Status mapping: `success` → paid, `failure/expired` → failed

## Background Jobs (BullMQ)

### Performance Metrics Aggregation

- **Queue**: `performance-metrics`
- **Schedule**: Daily
- **Action**: Read raw metrics from Redis sorted sets, calculate p50/p75/p90 percentiles, upsert into PerformanceMetric table, clear processed data from Redis

## i18n (Internationalization)

- **Library**: next-intl 4.8.3
- **Locales**: `uk` (default), `en`
- **Strategy**: `as-needed` prefix (no `/uk` prefix for default locale)
- **Translation files**: `src/messages/uk.json`, `src/messages/en.json`
- **Usage**: `useTranslations('namespace')` hook in client components

## API Documentation

- **Swagger UI**: `/api-docs` (serves interactive API explorer)
- **OpenAPI spec**: `public/openapi.json` (generated via `npm run docs:generate`)
- **Source**: `src/lib/swagger.ts` (OpenAPI 3.0 document)
