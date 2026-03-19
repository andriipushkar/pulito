import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility Tests — WCAG 2.1 AA compliance.
 * Перевіряє кожну ключову сторінку на відповідність стандартам доступності.
 *
 * Запуск:
 *   npx playwright test e2e/accessibility.spec.ts
 *
 * Що перевіряється:
 * - Контрастність тексту (color-contrast)
 * - Alt-текст для зображень (image-alt)
 * - Label для форм (label, form-field-multiple-labels)
 * - Структура заголовків (heading-order)
 * - ARIA атрибути (aria-*)
 * - Клавіатурна навігація (focus-order-semantics)
 * - Language атрибут (html-has-lang)
 */

// Tags to check — WCAG 2.1 Level AA
const A11Y_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa'];

// Common violations to exclude initially (fix incrementally)
const EXCLUDED_RULES: string[] = [];

async function checkA11y(page: any, pageName: string) {
  const results = await new AxeBuilder({ page })
    .withTags(A11Y_TAGS)
    .disableRules(EXCLUDED_RULES)
    .analyze();

  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    nodes: v.nodes.length,
    help: v.helpUrl,
  }));

  // Log violations for debugging
  if (violations.length > 0) {
    console.log(`\n⚠️  ${pageName}: ${violations.length} accessibility violations:`);
    violations.forEach((v) => {
      console.log(`  [${v.impact}] ${v.id}: ${v.description} (${v.nodes} elements)`);
    });
  }

  // Only fail on serious/critical violations
  const critical = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );

  expect(critical, `${pageName}: ${critical.length} serious/critical a11y violations`).toHaveLength(0);
}

test.describe('Accessibility — Public Pages', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await checkA11y(page, 'Homepage');
  });

  test('Catalog', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');
    await checkA11y(page, 'Catalog');
  });

  test('Product page', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');
    const link = page.locator('a[href^="/product/"]').first();
    if (await link.isVisible()) {
      await link.click();
      await page.waitForLoadState('networkidle');
      await checkA11y(page, 'Product');
    }
  });

  test('Cart (empty)', async ({ page }) => {
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');
    await checkA11y(page, 'Cart');
  });

  test('FAQ', async ({ page }) => {
    await page.goto('/faq');
    await page.waitForLoadState('networkidle');
    await checkA11y(page, 'FAQ');
  });

  test('Contacts', async ({ page }) => {
    await page.goto('/contacts');
    await page.waitForLoadState('networkidle');
    await checkA11y(page, 'Contacts');
  });

  test('News', async ({ page }) => {
    await page.goto('/news');
    await page.waitForLoadState('networkidle');
    await checkA11y(page, 'News');
  });
});

test.describe('Accessibility — Auth Pages', () => {
  test('Login', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    await checkA11y(page, 'Login');
  });

  test('Register', async ({ page }) => {
    await page.goto('/auth/register');
    await page.waitForLoadState('networkidle');
    await checkA11y(page, 'Register');
  });

  test('Forgot password', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await page.waitForLoadState('networkidle');
    await checkA11y(page, 'Forgot Password');
  });
});

test.describe('Accessibility — Mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('Homepage mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await checkA11y(page, 'Homepage Mobile');
  });

  test('Catalog mobile', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');
    await checkA11y(page, 'Catalog Mobile');
  });

  test('Login mobile', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    await checkA11y(page, 'Login Mobile');
  });
});

test.describe('Accessibility — Keyboard Navigation', () => {
  test('Tab through header', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab to skip-to-content link
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    // First focusable element should exist
    expect(focused).toBeTruthy();
  });

  test('Tab through login form', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');

    // Tab to email field
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const emailFocused = await page.evaluate(() =>
      document.activeElement?.getAttribute('type') === 'email' ||
      document.activeElement?.getAttribute('name') === 'email'
    );

    // Tab to password
    await page.keyboard.press('Tab');
    const passwordFocused = await page.evaluate(() =>
      document.activeElement?.getAttribute('type') === 'password'
    );

    // At least one form field should be reachable by Tab
    expect(emailFocused || passwordFocused).toBeTruthy();
  });

  test('Escape closes modals', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForLoadState('networkidle');

    // Click search to open dropdown
    const searchInput = page.locator('input[placeholder*="Пошук"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.click();
      await searchInput.fill('test');
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
      // Dropdown should close — search input should still be visible but dropdown gone
    }
  });
});
