import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { invalidateSettingsCache } from '@/services/settings';

export const GET = withRole('admin')(async () => {
  try {
    const settings = await prisma.siteSetting.findMany({
      orderBy: { key: 'asc' },
    });
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    return successResponse(map);
  } catch {
    return errorResponse('Помилка завантаження налаштувань', 500);
  }
});

function formatPhoneDisplay(phone: string): string {
  const match = phone.match(/^\+380(\d{2})(\d{3})(\d{2})(\d{2})$/);
  if (!match) return phone;
  return `+38 (0${match[1]}) ${match[2]}-${match[3]}-${match[4]}`;
}

export const PUT = withRole('admin')(async (request: NextRequest) => {
  try {
    const body = (await request.json()) as Record<string, string>;
    // Derive the display variant whenever the raw phone is updated, so the
    // public-facing text (TopBar/Header/Footer) tracks the click-to-call value.
    if (typeof body.site_phone === 'string' && body.site_phone_display === undefined) {
      body.site_phone_display = formatPhoneDisplay(body.site_phone);
    }
    const entries = Object.entries(body) as [string, string][];

    for (const [key, value] of entries) {
      await prisma.siteSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }

    await invalidateSettingsCache();
    // Settings feed the storefront layout (TopBar, Header, Footer); without
    // this, ISR keeps serving cached HTML until each route's revalidate window.
    revalidatePath('/', 'layout');
    return successResponse({ updated: entries.length });
  } catch {
    return errorResponse('Помилка збереження налаштувань', 500);
  }
});
