# ── Stage 1: Install dependencies ──────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# ── Stage 2: Build the application ────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Standalone output is the whole point of the Docker image — runner stage
# does `node server.js` from .next/standalone. next.config.ts gates this
# behind NEXT_BUILD_STANDALONE so local/VPS pm2 builds stay clean.
ENV NEXT_BUILD_STANDALONE=1

RUN npx prisma generate
RUN npm run build

# ── Stage 3: Production runner ────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/health', (r) => { if(r.statusCode !== 200) process.exit(1) })"

CMD ["node", "server.js"]
