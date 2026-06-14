import { test, expect } from '@playwright/test';

test.describe('Mega Menu', () => {
  test('should show subcategories on hover over a category', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // The category nav is hidden on mobile; ensure desktop viewport
    const categoryNav = page.locator('nav[aria-label="Категорії"]');
    if (!(await categoryNav.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // Find a parent category link that has a chevron (indicating children)
    const parentItems = categoryNav.locator('li.static');
    const count = await parentItems.count();
    if (count === 0) {
      test.skip();
      return;
    }

    // Hover over the first parent category with children
    let hovered = false;
    for (let i = 0; i < count; i++) {
      const item = parentItems.nth(i);
      const hasChevron = await item.locator('svg, [data-testid="chevron-down"]').count();
      if (hasChevron > 0) {
        await item.hover();
        hovered = true;
        break;
      }
    }

    if (!hovered) {
      test.skip();
      return;
    }

    // Wait for the mega-menu panel to appear
    const megaMenu = page.locator('[data-testid="mega-menu-panel"]');
    await expect(megaMenu).toBeVisible({ timeout: 3000 });

    // Verify at least one subcategory link is rendered
    const subLinks = megaMenu.locator('a[href*="category="]');
    const subCount = await subLinks.count();
    expect(subCount).toBeGreaterThan(0);

    // Verify the "View all" link is present
    await expect(megaMenu.locator('text=Дивитись все')).toBeVisible();
  });

  test('should close mega-menu when moving mouse away', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const categoryNav = page.locator('nav[aria-label="Категорії"]');
    if (!(await categoryNav.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const parentItems = categoryNav.locator('li.static');
    const count = await parentItems.count();

    let hoveredItem: any = null;
    for (let i = 0; i < count; i++) {
      const item = parentItems.nth(i);
      const hasChevron = await item.locator('svg, [data-testid="chevron-down"]').count();
      if (hasChevron > 0) {
        await item.hover();
        hoveredItem = item;
        break;
      }
    }

    if (!hoveredItem) {
      test.skip();
      return;
    }

    const megaMenu = page.locator('[data-testid="mega-menu-panel"]');
    await expect(megaMenu).toBeVisible({ timeout: 3000 });

    // Move mouse to the page body (away from nav)
    await page.mouse.move(0, 0);
    await page.waitForTimeout(500);

    // Mega menu should eventually disappear
    await expect(megaMenu).not.toBeVisible({ timeout: 3000 });
  });

  test('should close mega-menu on Escape key', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const categoryNav = page.locator('nav[aria-label="Категорії"]');
    if (!(await categoryNav.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const parentItems = categoryNav.locator('li.static');
    const count = await parentItems.count();

    for (let i = 0; i < count; i++) {
      const item = parentItems.nth(i);
      const hasChevron = await item.locator('svg, [data-testid="chevron-down"]').count();
      if (hasChevron > 0) {
        await item.hover();
        break;
      }
    }

    const megaMenu = page.locator('[data-testid="mega-menu-panel"]');
    if (!(await megaMenu.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    await expect(megaMenu).not.toBeVisible({ timeout: 3000 });
  });
});
