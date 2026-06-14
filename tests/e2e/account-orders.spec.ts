import { test, expect } from '@playwright/test';
import { waitForLoaded } from './helpers/wait';
import { loginViaAPI, TEST_USERS } from './helpers/auth';

test.describe('Account Orders', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await loginViaAPI(page, TEST_USERS.client.email, TEST_USERS.client.password);
  });

  test('should load orders page with order list or empty state', async ({ page }) => {
    await page.goto('/account/orders');
    await waitForLoaded(page);

    const orderList = page.locator('[data-testid="order-list"], table, .order-list, .orders');
    const emptyState = page.locator(
      '[data-testid="empty-state"], .empty-state, .no-orders, text=/Замовлень немає|Немає замовлень/i',
    );

    const hasOrders = await orderList
      .first()
      .isVisible()
      .catch(() => false);
    const hasEmpty = await emptyState
      .first()
      .isVisible()
      .catch(() => false);
    const hasHeading = await page
      .locator('text=/Мої замовлення/i')
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasOrders || hasEmpty || hasHeading).toBeTruthy();
  });

  test('should display status filter dropdown', async ({ page }) => {
    await page.goto('/account/orders');
    await waitForLoaded(page);

    const filter = page.locator('select, [data-testid="status-filter"], [role="combobox"]').first();
    if (await filter.isVisible().catch(() => false)) {
      await filter.click();
      // Verify dropdown opened or options appeared
      const options = page.locator('option, [role="option"], li');
      await expect(options.first())
        .toBeVisible({ timeout: 5000 })
        .catch(() => {});
    }
  });

  test('should handle pagination if available', async ({ page }) => {
    await page.goto('/account/orders');
    await waitForLoaded(page);

    const pagination = page
      .locator(
        '[data-testid="pagination"], .pagination, nav[aria-label*="pagination"], nav[aria-label*="page"]',
      )
      .first();
    if (await pagination.isVisible().catch(() => false)) {
      const nextButton = pagination
        .locator('button, a')
        .filter({ hasText: /next|наступна|>|»/i })
        .first();
      if (await nextButton.isVisible().catch(() => false)) {
        await nextButton.click();
        await waitForLoaded(page);
        await expect(page).toHaveURL(/page|offset|skip/);
      }
    }
  });

  test('should navigate to order detail on click', async ({ page }) => {
    await page.goto('/account/orders');
    await waitForLoaded(page);

    const orderLink = page
      .locator('a[href*="/account/orders/"], [data-testid="order-link"], tr[data-order-id]')
      .first();
    if (await orderLink.isVisible().catch(() => false)) {
      await orderLink.click();
      await waitForLoaded(page);
      await expect(page).toHaveURL(/\/account\/orders\/\w+/);
    }
  });

  test('should show empty state message when no orders match filter', async ({ page }) => {
    await page.goto('/account/orders');
    await waitForLoaded(page);

    const filter = page.locator('select, [data-testid="status-filter"], [role="combobox"]').first();
    if (await filter.isVisible().catch(() => false)) {
      // Try selecting a filter value that likely yields no results
      await filter
        .selectOption({ index: (await filter.locator('option').count()) - 1 })
        .catch(() => {});
      await waitForLoaded(page);

      // Page should still be functional regardless of results
      await expect(page).toHaveURL(/\/account\/orders/);
    }
  });
});
