import { Page, expect } from '@playwright/test';

// Keep in sync with scripts/seed-users.ts
const TEST_PASSWORD = 'Test1234!';

export const TEST_USERS = {
  admin: {
    email: 'admin@pulito.trade',
    password: TEST_PASSWORD,
    fullName: 'Адміністратор',
  },
  manager: {
    email: 'manager@pulito.trade',
    password: TEST_PASSWORD,
    fullName: 'Менеджер',
  },
  client: {
    email: 'client@pulito.trade',
    password: TEST_PASSWORD,
    fullName: 'Роздрібний клієнт',
  },
  wholesale: {
    email: 'wholesale1@pulito.trade',
    password: TEST_PASSWORD,
    fullName: 'Оптовий клієнт (група 1)',
  },
};

/**
 * Login via the UI login form.
 */
export async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto('/auth/login');
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();
  // Wait for redirect away from login page
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 10000 });
}

/**
 * Login via API and set token in localStorage (faster).
 */
export async function loginViaAPI(page: Page, email: string, password: string) {
  const baseURL = page.url().split('/').slice(0, 3).join('/') || 'http://localhost:3000';

  const response = await page.request.post(`${baseURL}/api/v1/auth/login`, {
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    data: { email, password },
  });

  const body = await response.json();
  if (!body.success || !body.data?.accessToken) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(body)}`);
  }

  // Store tokens in localStorage for the app to use
  await page.evaluate(
    ({ accessToken, refreshToken }) => {
      localStorage.setItem('accessToken', accessToken);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    },
    { accessToken: body.data.accessToken, refreshToken: body.data.refreshToken },
  );

  return body.data;
}

/**
 * Ensure the user is logged out.
 */
export async function logout(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  });
}
