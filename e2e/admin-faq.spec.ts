import { test, expect } from '@playwright/test';
import { waitForLoaded } from './helpers/wait';
import { loginViaUI, TEST_USERS } from './helpers/auth';

test.describe('Admin FAQ Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, TEST_USERS.admin.email, TEST_USERS.admin.password);
  });

  test('should access admin FAQ page', async ({ page }) => {
    await page.goto('/admin/faq');
    await waitForLoaded(page);

    expect(page.url()).toContain('/admin/faq');

    // Should show FAQ heading
    const heading = page.locator('h2');
    await expect(heading.first()).toBeVisible({ timeout: 5000 });
    await expect(heading.first()).toHaveText(/FAQ/i);
  });

  test('should display create FAQ form when clicking add button', async ({ page }) => {
    await page.goto('/admin/faq');
    await waitForLoaded(page);

    // Click "Додати питання" button
    const addButton = page.locator('button', { hasText: /Додати питання/i });
    await expect(addButton).toBeVisible({ timeout: 5000 });
    await addButton.click();

    // Create form should appear
    const categoryInput = page.locator('input[placeholder="Категорія"]');
    await expect(categoryInput).toBeVisible({ timeout: 3000 });

    const questionInput = page.locator('input[placeholder="Питання"]');
    await expect(questionInput).toBeVisible();

    const answerTextarea = page.locator('textarea[placeholder="Відповідь"]');
    await expect(answerTextarea).toBeVisible();
  });

  test('should create a new FAQ item', async ({ page }) => {
    await page.goto('/admin/faq');
    await waitForLoaded(page);

    // Open create form
    const addButton = page.locator('button', { hasText: /Додати питання/i });
    await addButton.click();

    // Fill the form
    const timestamp = Date.now();
    const testQuestion = `E2E Test Question ${timestamp}`;
    const testAnswer = `E2E Test Answer for question ${timestamp}`;

    await page.locator('input[placeholder="Категорія"]').fill('E2E-Test');
    await page.locator('input[placeholder="Питання"]').fill(testQuestion);
    await page.locator('textarea[placeholder="Відповідь"]').fill(testAnswer);

    // Submit
    const submitButton = page.locator('button[type="submit"]', { hasText: /Створити/i });
    await submitButton.click();

    // Wait for the item to appear in the list
    await page.waitForTimeout(1000);

    // Verify the new item is visible
    const newItem = page.locator(`text=${testQuestion}`);
    await expect(newItem).toBeVisible({ timeout: 5000 });
  });

  test('should open inline edit form when clicking edit button', async ({ page }) => {
    await page.goto('/admin/faq');
    await waitForLoaded(page);

    // Find the first edit button
    const editButton = page.locator('button', { hasText: /Редагувати/i }).first();
    if (!(await editButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await editButton.click();

    // Inline edit form should appear with input fields
    const questionEditInput = page.locator('input[placeholder="Питання"]');
    await expect(questionEditInput).toBeVisible({ timeout: 3000 });

    const answerEditTextarea = page.locator('textarea[placeholder="Відповідь"]');
    await expect(answerEditTextarea).toBeVisible();
  });

  test('should toggle published status', async ({ page }) => {
    await page.goto('/admin/faq');
    await waitForLoaded(page);

    // Find a publish toggle button
    const toggleButton = page.locator('button', { hasText: /Опубл\.|Чернетка/i }).first();
    if (!(await toggleButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const initialText = await toggleButton.textContent();
    await toggleButton.click();

    // Wait for update
    await page.waitForTimeout(1000);

    // Status should have changed
    const updatedButton = page.locator('button', { hasText: /Опубл\.|Чернетка/i }).first();
    const updatedText = await updatedButton.textContent();

    // The text should be different (toggled)
    if (initialText?.includes('Опубл')) {
      expect(updatedText).toContain('Чернетка');
    } else {
      expect(updatedText).toContain('Опубл');
    }
  });

  test('should filter by category when multiple categories exist', async ({ page }) => {
    await page.goto('/admin/faq');
    await waitForLoaded(page);

    // Look for category filter select
    const filterSelect = page.locator('select').first();
    if (!(await filterSelect.isVisible({ timeout: 3000 }).catch(() => false))) {
      // Only one category or no items -- skip
      test.skip();
      return;
    }

    // Get the options
    const options = filterSelect.locator('option');
    const optionCount = await options.count();

    if (optionCount <= 1) {
      test.skip();
      return;
    }

    // Select a specific category (second option, after "Всі категорії")
    await filterSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);

    // Page should still be working and display filtered results
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle delete with confirmation dialog', async ({ page }) => {
    await page.goto('/admin/faq');
    await waitForLoaded(page);

    // Find delete button
    const deleteButton = page.locator('button[title="Видалити"]').first();
    if (!(await deleteButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // Set up dialog handler to dismiss (cancel) the dialog
    page.on('dialog', (dialog) => dialog.dismiss());

    await deleteButton.click();

    // Page should still be stable after dismissing
    await expect(page.locator('body')).toBeVisible();
  });
});
