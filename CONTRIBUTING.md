# Contributing

## Getting started

1. Clone the repo and install dependencies:

   ```bash
   git clone <repo-url> && cd clean
   npm install
   ```

2. Set up local environment:

   ```bash
   cp .env.example .env
   docker compose up -d
   npm run db:generate && npm run db:migrate && npm run db:seed
   npm run dev
   ```

3. Full setup guide: [documents/setup/01-local-development.md](documents/setup/01-local-development.md)

## Code style

- **TypeScript strict mode** — no `any` types in production code
- **ESLint + Prettier** — run `npm run lint` before committing
- **Naming:** camelCase for variables/functions, PascalCase for components/types
- **Imports:** absolute paths via `@/` alias (e.g., `@/services/email`)
- **API routes:** Zod validation on all inputs, consistent error responses via `apiResponse()`
- **Tests:** co-located with source files (e.g., `email.ts` + `email.test.ts`)

## Branch workflow

1. Create a branch from `main`:
   ```bash
   git checkout -b feature/your-feature
   ```
2. Make changes, write tests
3. Run checks:
   ```bash
   npm run lint
   npm test
   npm run build
   ```
4. Push and create a PR against `main`

## Pull request guidelines

- Keep PRs focused — one feature or fix per PR
- Include tests for new functionality
- Update documentation if behavior changes
- PR title: short, imperative mood (e.g., "Add order export to CSV")
- Description: what changed and why

## Testing

| Type             | Command                 | Location           |
| ---------------- | ----------------------- | ------------------ |
| Unit/Integration | `npm test`              | `src/**/*.test.ts` |
| E2E              | `npm run test:e2e`      | `e2e/*.spec.ts`    |
| Coverage         | `npm run test:coverage` | —                  |
| Load             | `k6 run k6/*.js`        | `k6/`              |

- All services, API routes, components, and cron jobs must have tests
- Use `.env.test` for CI/test environment variables

## Project structure

```
src/
├── app/           # Next.js pages and API routes
├── components/    # React components
├── services/      # Business logic
├── validators/    # Zod schemas
├── hooks/         # React hooks
├── middleware/     # Auth, rate limiting
├── lib/           # Prisma, Redis, API client
└── utils/         # Helper functions
```

## Questions?

Open an issue or reach out to the maintainer.
