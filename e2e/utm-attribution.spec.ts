import { test, expect } from '@playwright/test';

test.describe('UTM attribution', () => {
  test('captures Telegram-bot UTMs from URL into cookie', async ({ page, context }) => {
    await page.goto('/?utm_source=telegram&utm_medium=bot&utm_campaign=new_arrivals');

    // UtmTracker writes the cookie inside a useEffect — wait for it to run.
    await page.waitForFunction(() => document.cookie.includes('pulito_utm'));

    const cookies = await context.cookies();
    const utmCookie = cookies.find((c) => c.name === 'pulito_utm');
    expect(utmCookie).toBeDefined();

    const decoded = JSON.parse(decodeURIComponent(utmCookie!.value));
    expect(decoded).toEqual({
      utmSource: 'telegram',
      utmMedium: 'bot',
      utmCampaign: 'new_arrivals',
    });
  });

  test('persists UTMs across navigation (first-touch)', async ({ page }) => {
    await page.goto('/?utm_source=telegram&utm_medium=bot&utm_campaign=promo');
    await page.waitForFunction(() => document.cookie.includes('pulito_utm'));

    await page.goto('/catalog');
    await page.waitForFunction(() => document.cookie.includes('pulito_utm'));

    const stored = await page.evaluate(() => {
      const m = document.cookie.match(/pulito_utm=([^;]+)/);
      return m ? JSON.parse(decodeURIComponent(m[1])) : null;
    });

    expect(stored).toEqual({
      utmSource: 'telegram',
      utmMedium: 'bot',
      utmCampaign: 'promo',
    });
  });

  test('cookie payload matches checkout body shape (utmSource/Medium/Campaign)', async ({
    page,
  }) => {
    await page.goto('/?utm_source=telegram&utm_medium=bot&utm_campaign=new_arrivals');
    await page.waitForFunction(() => document.cookie.includes('pulito_utm'));

    // Mirrors the read path in checkout/page.tsx — confirms the cookie shape
    // matches what the order POST body expects.
    const payload = await page.evaluate(() => {
      const m = document.cookie.match(/pulito_utm=([^;]+)/);
      return m ? JSON.parse(decodeURIComponent(m[1])) : null;
    });

    expect(payload).toMatchObject({
      utmSource: 'telegram',
      utmMedium: 'bot',
      utmCampaign: 'new_arrivals',
    });
  });
});
