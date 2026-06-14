import { test, expect, Page } from '@playwright/test';
import { loginViaUI, TEST_USERS } from './helpers/auth';
import { waitForLoaded } from './helpers/wait';

/**
 * Admin smoke: opens EVERY static admin page under an authenticated session
 * and fails on client-side runtime errors — the class of bug curl-based
 * deploy checks can't see (SSR returns 200, the page crashes in the browser
 * after a client fetch, e.g. the /admin/not-found-log paginatedResponse
 * mismatch found 2026-06-11).
 *
 * Detects per route:
 *  - uncaught exceptions (pageerror)
 *  - the error boundary («Помилка» heading from app/error.tsx / admin/error.tsx)
 *  - HTTP ≥ 500 on document load
 *  - a lost session (redirect back to /auth/login)
 *
 * Credentials: E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD env vars when running
 * against a real database; falls back to the seeded dev admin
 * (helpers/auth TEST_USERS) otherwise.
 *
 * Route list = every page.tsx under src/app/(admin) without dynamic segments.
 * Regenerate after adding pages:
 *   find 'src/app/(admin)' -name page.tsx | sed 's|src/app/(admin)||;s|/page.tsx||' | grep -v '\[' | sort
 */

const ADMIN_ROUTES = [
  '/admin',
  '/admin/analytics',
  '/admin/ask',
  '/admin/audit-log',
  '/admin/badges',
  '/admin/banners',
  '/admin/billing',
  '/admin/billing/plans',
  '/admin/blog',
  '/admin/blog/categories',
  '/admin/blog/comments',
  '/admin/bot-settings',
  '/admin/brands',
  '/admin/bundles',
  '/admin/campaigns',
  '/admin/categories',
  '/admin/channels',
  '/admin/channel-settings',
  '/admin/chat',
  '/admin/coupons',
  '/admin/delivery-settings',
  '/admin/domains',
  '/admin/email-templates',
  '/admin/faq',
  '/admin/faq/categories',
  '/admin/feature-flags',
  '/admin/feedback',
  '/admin/feeds',
  '/admin/forecasting',
  '/admin/google-business',
  '/admin/health',
  '/admin/homepage',
  '/admin/import',
  '/admin/integrations',
  '/admin/loyalty',
  '/admin/loyalty/challenges',
  '/admin/marketplaces',
  '/admin/marketplaces/audit',
  '/admin/marketplaces/buyer',
  '/admin/marketplaces/categories',
  '/admin/marketplaces/disputes',
  '/admin/marketplaces/help',
  '/admin/marketplaces/pick-list',
  '/admin/marketplaces/pricing-parity',
  '/admin/marketplaces/repricing',
  '/admin/marketplaces/returns',
  '/admin/moderation',
  '/admin/not-found-log',
  '/admin/orders',
  '/admin/orders/board',
  '/admin/orders/bulk',
  '/admin/pack',
  '/admin/pages',
  '/admin/pallet-delivery',
  '/admin/payment-settings',
  '/admin/personal-prices',
  '/admin/products',
  '/admin/products/duplicates',
  '/admin/products/image-quality',
  '/admin/products/new',
  '/admin/publications',
  '/admin/publication-templates',
  '/admin/referrals',
  '/admin/reports',
  '/admin/reports/builder',
  '/admin/scan-sheets',
  '/admin/search-intel',
  '/admin/segments',
  '/admin/seo-audit',
  '/admin/seo-templates',
  '/admin/settings',
  '/admin/setup-2fa',
  '/admin/smtp-settings',
  '/admin/stock-counts',
  '/admin/subscriptions',
  '/admin/tax-report',
  '/admin/tenants',
  '/admin/themes',
  '/admin/users',
  '/admin/volume-discounts',
  '/admin/warehouses',
  '/admin/warehouse-transfers',
  '/admin/warehouse-transfers/new',
  '/admin/webhooks',
  '/admin/wholesale-rules',
];

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || TEST_USERS.admin.email;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || TEST_USERS.admin.password;

// Both error boundaries (root and admin) render this exact heading.
async function hasErrorBoundary(page: Page): Promise<boolean> {
  return page
    .getByRole('heading', { name: /^Помилка$/ })
    .first()
    .isVisible()
    .catch(() => false);
}

test.describe('Admin smoke — client runtime errors', () => {
  // Mobile project re-runs the same pages for no extra signal — desktop only.
  test.skip(({ isMobile }) => isMobile, 'desktop-only smoke');

  test('every static admin page renders without client errors', async ({ page }) => {
    test.setTimeout(ADMIN_ROUTES.length * 20_000);

    const failures: string[] = [];
    let pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await loginViaUI(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    for (const route of ADMIN_ROUTES) {
      pageErrors = [];
      let response;
      try {
        response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      } catch (e) {
        failures.push(`${route} → navigation failed: ${String(e).slice(0, 120)}`);
        continue;
      }
      // Let client-side fetches settle (networkidle never fires — admin holds
      // an SSE connection for live badges, so wait on the spinner instead).
      await waitForLoaded(page);
      await page.waitForTimeout(500);

      const status = response?.status() ?? 0;
      if (status >= 500) failures.push(`${route} → HTTP ${status}`);
      else if (page.url().includes('/auth/login')) failures.push(`${route} → session lost`);
      else if (pageErrors.length > 0)
        failures.push(`${route} → uncaught: ${pageErrors[0].slice(0, 160)}`);
      else if (await hasErrorBoundary(page)) {
        const msg = await page
          .locator('h1 + p')
          .first()
          .textContent()
          .catch(() => '');
        failures.push(`${route} → error boundary: ${(msg || '').slice(0, 160)}`);
      }
    }

    expect(failures, `Сторінки з клієнтськими помилками:\n${failures.join('\n')}`).toEqual([]);
  });
});
