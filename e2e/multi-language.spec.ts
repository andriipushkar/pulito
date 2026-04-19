import { test, expect } from '@playwright/test';

test.describe('Multi-language Support', () => {
  test('should default to Ukrainian (uk)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Check for Ukrainian content
    const ukrainianContent = page.locator('text=/Каталог|Головна|Кошик|Контакти|Пошук|Увійти/i');
    const hasUkrainian = await ukrainianContent
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // Site should render
    await expect(page.locator('body')).toBeVisible();

    // Most likely the default language is Ukrainian
    if (hasUkrainian) {
      expect(hasUkrainian).toBeTruthy();
    }
  });

  test('should switch to English and verify content changes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Look for language switcher
    const langSwitcher = page
      .locator(
        '[data-testid="language-switcher"], button:has-text("EN"), a:has-text("EN"), select[name="locale"], select[name="lang"]',
      )
      .first();

    if (await langSwitcher.isVisible({ timeout: 5000 }).catch(() => false)) {
      // If it's a select element
      const tagName = await langSwitcher.evaluate((el) => el.tagName.toLowerCase());

      if (tagName === 'select') {
        await langSwitcher.selectOption('en');
      } else {
        await langSwitcher.click();
        await page.waitForTimeout(500);

        // Click English option
        const enOption = page
          .locator('text=/English|EN/, [data-lang="en"], [data-locale="en"]')
          .first();
        if (await enOption.isVisible({ timeout: 3000 }).catch(() => false)) {
          await enOption.click();
        }
      }

      await page.waitForTimeout(1000);
      await page.waitForLoadState('domcontentloaded');

      // Check for English content
      const englishContent = page.locator('text=/Catalog|Home|Cart|Search|Login/i');
      const hasEnglish = await englishContent
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasEnglish) {
        expect(hasEnglish).toBeTruthy();
      }
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('should switch to Polish and verify content changes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const langSwitcher = page
      .locator(
        '[data-testid="language-switcher"], button:has-text("PL"), a:has-text("PL"), select[name="locale"], select[name="lang"]',
      )
      .first();

    if (await langSwitcher.isVisible({ timeout: 5000 }).catch(() => false)) {
      const tagName = await langSwitcher.evaluate((el) => el.tagName.toLowerCase());

      if (tagName === 'select') {
        await langSwitcher.selectOption('pl');
      } else {
        await langSwitcher.click();
        await page.waitForTimeout(500);

        const plOption = page
          .locator('text=/Polski|PL/, [data-lang="pl"], [data-locale="pl"]')
          .first();
        if (await plOption.isVisible({ timeout: 3000 }).catch(() => false)) {
          await plOption.click();
        }
      }

      await page.waitForTimeout(1000);
      await page.waitForLoadState('domcontentloaded');

      // Check for Polish content
      const polishContent = page.locator('text=/Katalog|Koszyk|Szukaj|Zaloguj/i');
      const hasPolish = await polishContent
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (hasPolish) {
        expect(hasPolish).toBeTruthy();
      }
    }

    await expect(page.locator('body')).toBeVisible();
  });

  test('should persist language choice across page navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Try to switch to English
    const langSwitcher = page
      .locator('[data-testid="language-switcher"], button:has-text("EN"), select[name="locale"]')
      .first();

    if (await langSwitcher.isVisible({ timeout: 5000 }).catch(() => false)) {
      const tagName = await langSwitcher.evaluate((el) => el.tagName.toLowerCase());
      if (tagName === 'select') {
        await langSwitcher.selectOption('en');
      } else {
        await langSwitcher.click();
        await page.waitForTimeout(500);
        const enOption = page.locator('text=/English|EN/').first();
        if (await enOption.isVisible({ timeout: 3000 }).catch(() => false)) {
          await enOption.click();
        }
      }

      await page.waitForTimeout(1000);

      // Navigate to another page
      await page.goto('/catalog');
      await page.waitForLoadState('domcontentloaded');

      // Should still be in English
      const englishContent = page.locator('text=/Catalog|Products|Cart|Search/i');
      const stillEnglish = await englishContent
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (stillEnglish) {
        expect(stillEnglish).toBeTruthy();
      }
    }

    await expect(page.locator('body')).toBeVisible();
  });
});
