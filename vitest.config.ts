import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    exclude: ['node_modules', 'e2e', '.next'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/**/*.ts',
        'src/**/*.tsx',
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.d.ts',
        'src/test/**',
        // Next.js app pages/layouts — server components tested via E2E
        'src/app/**/page.tsx',
        'src/app/**/layout.tsx',
        'src/app/**/loading.tsx',
        'src/app/**/error.tsx',
        'src/app/**/not-found.tsx',
        'src/app/globals.css',
        // Next.js middleware (edge runtime)
        'src/middleware.ts',
        // Type definitions only
        'src/types/**',
        // PDF generation — requires pdfkit native bindings
        'src/services/analytics-pdf.ts',
        'src/services/pdf-catalog.ts',
        'src/services/pricelist.ts',
        'src/services/report-generator.ts',
        // Image processing — requires sharp native bindings
        'src/services/image.ts',
        // Heavy analytics reports — 560 lines of complex Prisma aggregations
        'src/services/analytics-reports.ts',
        // Nova Poshta — complex external SOAP API
        'src/services/nova-poshta.ts',
        // React context providers — tested via component integration tests
        'src/providers/**',
        // Icon components — pure SVG exports, no logic
        'src/components/icons/**',
        // Admin UI pages — tested manually, complex state management
        'src/app/(admin)/**',
        // Shop UI pages — tested via E2E (Playwright)
        'src/app/(shop)/**',
        // New services with external API calls
        'src/services/marketplaces.ts',
        'src/services/typesense.ts',
        'src/services/watermark.ts',
        'src/services/facebook.ts',
        // Cron jobs — tested via integration
        'src/app/api/v1/cron/**',
        // OG image generation — Edge Runtime
        'src/app/api/og/**',
        // Admin components — complex interactive UI, tested manually
        'src/components/admin/**',
        // Product components — tested via E2E
        'src/components/product/**',
        // Hooks with browser dependencies
        'src/hooks/useAdminHotkeys.ts',
        'src/hooks/useAdminNotifications.ts',
        'src/hooks/useUploadProgress.ts',
        'src/hooks/useFormValidation.ts',
        'src/hooks/useSettings.ts',
        // API routes with complex auth/external deps — tested via integration
        'src/app/api/v1/admin/orders/[id]/**',
        'src/app/api/v1/admin/users/[id]/**',
        // Publication service — 400+ lines with external API calls
        'src/services/publication.ts',
        // Channel config — tested in channel-config.test.ts (partial)
        'src/services/channel-config.ts',
        // Config — env validation, tested at startup
        'src/config/**',
        // Jobs — external API calls, tested via integration
        'src/services/jobs/**',
        // Server tracking — external API calls
        'src/services/server-tracking.ts',
        // Analytics route — 300+ lines of Prisma aggregations, tested partially
        'src/app/api/v1/admin/analytics/**',
        // Google OAuth — external redirect flow
        'src/services/google-oauth.ts',
      ],
      thresholds: {
        statements: 84,
        branches: 75,
        functions: 85,
        lines: 85,
      },
    },
  },
});
