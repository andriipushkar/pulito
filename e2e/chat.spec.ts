import { test, expect } from '@playwright/test';

test.describe('Chat Widget', () => {
  test('should display chat bubble on shop page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const chatBubble = page.locator('[data-testid="chat-bubble"]');
    await expect(chatBubble).toBeVisible({ timeout: 10000 });
  });

  test('should open chat panel when bubble is clicked', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const chatBubble = page.locator('[data-testid="chat-bubble"]');
    await expect(chatBubble).toBeVisible({ timeout: 10000 });

    await chatBubble.click();

    const chatPanel = page.locator('[data-testid="chat-panel"]');
    await expect(chatPanel).toBeVisible({ timeout: 5000 });
  });

  test('should show new chat button or room list inside panel', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const chatBubble = page.locator('[data-testid="chat-bubble"]');
    await chatBubble.click();

    const chatPanel = page.locator('[data-testid="chat-panel"]');
    await expect(chatPanel).toBeVisible({ timeout: 5000 });

    // Should show either "Новий чат" button or room list (depending on auth)
    const newChatBtn = page.locator('[data-testid="chat-new-room"]');
    const heading = chatPanel.locator('h3');

    const hasNewChat = await newChatBtn.isVisible({ timeout: 3000 }).catch(() => false);
    const hasHeading = await heading.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasNewChat || hasHeading).toBeTruthy();
  });

  test('should close chat panel when bubble is clicked again', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const chatBubble = page.locator('[data-testid="chat-bubble"]');
    await chatBubble.click();

    const chatPanel = page.locator('[data-testid="chat-panel"]');
    await expect(chatPanel).toBeVisible({ timeout: 5000 });

    // Click bubble again to close
    await chatBubble.click();
    await expect(chatPanel).not.toBeVisible({ timeout: 3000 });
  });
});
