# Demo Environment — Setup Guide for Buyers

## Quick Demo Access

**Live demo URL:** `https://dwxjrx69-3000.euw.devtunnels.ms`

### Test Accounts

| Role           | Email                | Password  | What you can see                             |
| -------------- | -------------------- | --------- | -------------------------------------------- |
| **Admin**      | admin@example.com    | Test1234! | Full admin panel (60 pages), all settings    |
| **Admin 2**    | admin@pulito.trade   | Test1234! | Second admin account                         |
| **Manager**    | manager@pulito.trade | Test1234! | Order management, limited admin              |
| **Wholesaler** | wholesaler@test.ua   | Test1234! | B2B prices, bulk order, finance, quick order |
| **Client**     | client@test.ua       | Test1234! | Regular shop experience                      |
| **Blocked**    | blocked@test.ua      | Test1234! | Error: account blocked                       |

### Demo Walkthrough (15 minutes)

**As Client (5 min):**

1. Open the storefront → browse catalog → use filters (category, price slider, availability)
2. Search "порошок" → instant search results with typo tolerance
3. Open product → zoom gallery, tabs, "З цим купують" recommendations
4. Add to cart → check mini-cart → go to cart page
5. Checkout (guest) → 4 steps → place order
6. Register new account → check loyalty dashboard, referral code

**As Wholesaler (3 min):**

1. Login as wholesaler@test.ua → see B2B dashboard (different from client)
2. Check wholesale prices (lower than retail)
3. Quick order → enter product codes → bulk add to cart
4. Finance tab → order history, monthly stats
5. Personal manager → see assigned manager contacts

**As Admin (7 min):**

1. /admin → KPI dashboard with auto-insights
2. Orders → filter, change status, generate PDF invoice
3. Products → CRUD, image upload (watermark applied), categories
4. Analytics → 18 tabs (ABC, RFM, LTV, cohorts, funnel, geography...)
5. Users → roles, wholesale approval, blocking
6. Settings → payment providers, delivery, SMTP, bot settings
7. Billing → SaaS plans, tenant management, usage metering
8. Blog → CRUD, categories, SEO
9. Check responsive: resize to 375px → full mobile experience

## Self-hosted Demo (for technical due diligence)

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- 2GB RAM minimum

### Setup (10 minutes)

```bash
# 1. Clone
git clone https://github.com/andriipushkar/pulito.git
cd clean

# 2. Install
npm install

# 3. Start infrastructure
docker compose up -d

# 4. Configure
cp .env.example .env
# Edit .env: set DATABASE_URL, REDIS_URL, JWT_SECRET

# 5. Database
npx prisma generate
npx prisma db push
npx prisma db seed

# 6. Run
npm run dev
# → http://localhost:3000
```

### What to verify during technical DD

1. **Code quality:** `npm run lint` → zero errors
2. **Tests:** `npm test` → all pass
3. **Build:** `npm run build` → standalone output
4. **Docker:** `docker compose up` → all 5 services healthy
5. **API docs:** open `/api-docs` → Swagger UI with 245 endpoints
6. **Type safety:** `npx tsc --noEmit` → zero errors
7. **Schema:** check `prisma/schema/` → 22 files, 94 models

### Key files to review

| What             | Where                                            |
| ---------------- | ------------------------------------------------ |
| Business logic   | `src/services/` (92 files)                       |
| API endpoints    | `src/app/api/v1/` (307 routes)                   |
| React components | `src/components/` (137 files)                    |
| Database schema  | `prisma/schema/` (22 files, 94 models)           |
| Tests            | `src/**/*.test.ts` (661 files)                   |
| E2E tests        | `e2e/` (71 specs)                                |
| Setup guides     | `documents/setup/` (29 files)                    |
| Manual tests     | `documents/testing/manual/` (30 files, 1,217 TC) |
| Architecture     | `documents/architecture/`                        |
| Configuration    | `.env.example` (73 variables)                    |
