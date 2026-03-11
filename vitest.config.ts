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
      ],
      thresholds: {
        statements: 99,
        branches: 96,
        functions: 98,
        lines: 99,
      },
    },
  },
});
