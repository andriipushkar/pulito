import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';
import { env } from '@/config/env';
import { timingSafeCompare } from '@/utils/timing-safe';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedToken = `Bearer ${env.APP_SECRET}`;

    if (!authHeader || !timingSafeCompare(authHeader, expectedToken)) {
      return errorResponse('Unauthorized', 401);
    }

    const appUrl = env.APP_URL;
    const issues: { type: string; url: string; status: number; details?: string }[] = [];

    // Check all active product pages
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { slug: true, name: true, content: { select: { seoTitle: true, seoDescription: true } } },
    });

    // Check for missing SEO fields
    for (const p of products) {
      if (!p.content?.seoTitle) {
        issues.push({ type: 'missing_meta_title', url: `/product/${p.slug}`, status: 0, details: p.name });
      }
      if (!p.content?.seoDescription) {
        issues.push({ type: 'missing_meta_description', url: `/product/${p.slug}`, status: 0, details: p.name });
      }
    }

    // Check sample of product pages for broken links (HTTP status)
    const sampleProducts = products.slice(0, 20); // Check first 20 to avoid overload
    for (const p of sampleProducts) {
      try {
        const res = await fetch(`${appUrl}/product/${p.slug}`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });
        if (res.status >= 400) {
          issues.push({ type: 'broken_link', url: `/product/${p.slug}`, status: res.status, details: p.name });
        }
      } catch {
        issues.push({ type: 'unreachable', url: `/product/${p.slug}`, status: 0, details: 'Timeout or network error' });
      }
    }

    // Check category pages
    const categories = await prisma.category.findMany({
      where: { isVisible: true },
      select: { slug: true, name: true },
    });

    for (const c of categories) {
      try {
        const res = await fetch(`${appUrl}/catalog?category=${c.slug}`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });
        if (res.status >= 400) {
          issues.push({ type: 'broken_category', url: `/catalog?category=${c.slug}`, status: res.status, details: c.name });
        }
      } catch {
        issues.push({ type: 'unreachable', url: `/catalog?category=${c.slug}`, status: 0 });
      }
    }

    // Save results to site_settings for admin to view
    await prisma.siteSetting.upsert({
      where: { key: 'seo_check_results' },
      update: { value: JSON.stringify({ issues, checkedAt: new Date().toISOString(), productsChecked: products.length }) },
      create: { key: 'seo_check_results', value: JSON.stringify({ issues, checkedAt: new Date().toISOString(), productsChecked: products.length }) },
    });

    // Alert via Telegram if critical issues found
    const brokenLinks = issues.filter((i) => i.type === 'broken_link');
    if (brokenLinks.length > 0) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_MANAGER_CHAT_ID;
      if (botToken && chatId) {
        const msg = [
          '⚠️ <b>SEO Аудит — знайдено проблеми</b>',
          '',
          `Битих посилань: <b>${brokenLinks.length}</b>`,
          `Без Meta Title: <b>${issues.filter((i) => i.type === 'missing_meta_title').length}</b>`,
          `Без Meta Description: <b>${issues.filter((i) => i.type === 'missing_meta_description').length}</b>`,
          '',
          'Деталі: /admin/seo-audit',
        ].join('\n');

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' }),
        });
      }
    }

    return successResponse({
      totalIssues: issues.length,
      brokenLinks: brokenLinks.length,
      missingMeta: issues.filter((i) => i.type.startsWith('missing_')).length,
      productsChecked: products.length,
    });
  } catch {
    return errorResponse('Помилка SEO перевірки', 500);
  }
}
