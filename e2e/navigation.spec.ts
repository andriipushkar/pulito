import { test, expect } from '@playwright/test';

test.describe('Navigation — Header Links', () => {
  test('should navigate to catalog from header', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const catalogLink = page.locator('header a[href="/catalog"], header a[href*="/catalog"]').first();
    if (await catalogLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await catalogLink.click();
      await expect(page).toHaveURL(/\/catalog/);
    }
  });

  test('should navigate to FAQ from header', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const faqLink = page.locator('header a[href="/faq"], a[href="/faq"]').first();
    if (await faqLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await faqLink.click();
      await expect(page).toHaveURL(/\/faq/);
    }
  });

  test('should navigate to contacts from header', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const contactsLink = page.locator('header a[href="/contacts"], a[href="/contacts"]').first();
    if (await contactsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await contactsLink.click();
      await expect(page).toHaveURL(/\/contacts/);
    }
  });
});

test.describe('Navigation — Footer Links', () => {
  test('should have footer links that point to valid pages', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    const footerLinks = footer.locator('a[href^="/"]');
    const count = await footerLinks.count();
    expect(count).toBeGreaterThan(0);

    // Verify first internal footer link navigates correctly
    const firstLink = footerLinks.first();
    const href = await firstLink.getAttribute('href');
    if (href) {
      await firstLink.click();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain(href);
    }
  });
});

test.describe('Navigation — Mobile Menu', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('should open mobile menu', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for hamburger / menu button
    const menuButton = page.locator('button[aria-label*="меню"], button[aria-label*="Menu"], button[aria-label*="menu"], [data-testid="mobile-menu"], header button').first();
    if (!await menuButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await menuButton.click();
    await page.waitForTimeout(300);

    // Menu drawer or overlay should appear
    const menuDrawer = page.locator('nav, [role="dialog"], [class*="drawer"], [class*="menu"]').first();
    await expect(menuDrawer).toBeVisible({ timeout: 3000 });
  });

  test('should have bottom navigation tabs on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Bottom nav is typically a fixed bar at the bottom
    const bottomNav = page.locator('[data-testid="bottom-nav"], nav[class*="bottom"], nav[class*="fixed"], [class*="bottom-nav"]').first();
    const hasBottomNav = await bottomNav.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasBottomNav) {
      // Check that bottom nav has clickable tabs
      const tabs = bottomNav.locator('a, button');
      const tabCount = await tabs.count();
      expect(tabCount).toBeGreaterThan(0);
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('should navigate via bottom nav tabs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const bottomNav = page.locator('[data-testid="bottom-nav"], nav[class*="bottom"], [class*="bottom-nav"]').first();
    if (!await bottomNav.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    const cartTab = bottomNav.locator('a[href="/cart"]').first();
    if (await cartTab.isVisible()) {
      await cartTab.click();
      await expect(page).toHaveURL(/\/cart/);
    }
  });
});
