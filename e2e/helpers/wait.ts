import { Page } from '@playwright/test';

/**
 * Wait for the app's loading spinner/text to disappear.
 * Admin and account pages render a "Завантаження..." skeleton while client-side
 * fetches run; `domcontentloaded` fires before data arrives.
 *
 * Safe to call on any page — resolves immediately if no loader is present.
 */
export async function waitForLoaded(page: Page, timeoutMs = 15000): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page
    .locator('text=/^Завантаження\\.?\\.?\\.?$/')
    .first()
    .waitFor({ state: 'hidden', timeout: timeoutMs })
    .catch(() => {});
  // Let React paint
  await page.waitForTimeout(100);
}
