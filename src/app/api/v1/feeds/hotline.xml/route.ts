import { NextRequest, NextResponse } from 'next/server';
import {
  getFeedContext,
  escapeXml,
  escapeCdata,
  FEED_CACHE_MAX_AGE,
} from '@/services/product-feeds';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';

export const dynamic = 'force-dynamic';
export const revalidate = 1800;

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await checkRateLimit(`ip:${ip}`, RATE_LIMITS.publicFeed);
  if (!rl.allowed) {
    return new NextResponse('Rate limit exceeded', { status: 429 });
  }

  const ctx = await getFeedContext();

  const categories = new Map<string, string>();
  for (const item of ctx.items) {
    if (item.category && !categories.has(item.category)) {
      categories.set(item.category, item.category);
    }
  }

  const categoryIds = new Map<string, number>();
  let cid = 1;
  for (const name of categories.keys()) {
    categoryIds.set(name, cid++);
  }

  const date = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<price date="${date}">`);
  lines.push(`  <firmName>${escapeXml(ctx.siteName)}</firmName>`);
  lines.push(`  <firmId>1</firmId>`);
  lines.push(`  <rate currency="UAH">1</rate>`);

  lines.push('  <categories>');
  for (const [name, id] of categoryIds) {
    lines.push(`    <category><id>${id}</id><name>${escapeXml(name)}</name></category>`);
  }
  lines.push('  </categories>');

  lines.push('  <items>');
  for (const item of ctx.items) {
    if (!item.available || !item.imageUrl) continue;
    const catId = item.category ? categoryIds.get(item.category) : undefined;

    lines.push('    <item>');
    lines.push(`      <id>${item.id}</id>`);
    lines.push(`      <code>${escapeXml(item.code)}</code>`);
    if (catId) lines.push(`      <categoryId>${catId}</categoryId>`);
    if (item.brand) lines.push(`      <vendor>${escapeXml(item.brand)}</vendor>`);
    lines.push(`      <name>${escapeXml(item.name)}</name>`);
    if (item.shortDescription) {
      lines.push(
        `      <description><![CDATA[${escapeCdata(item.shortDescription)}]]></description>`,
      );
    }
    lines.push(`      <url>${escapeXml(item.url)}</url>`);
    lines.push(`      <image>${escapeXml(item.imageUrl)}</image>`);
    lines.push(`      <priceRUAH>${item.price.toFixed(2)}</priceRUAH>`);
    lines.push(`      <stock>В наявності</stock>`);
    if (item.barcode) lines.push(`      <barcode>${escapeXml(item.barcode)}</barcode>`);
    lines.push('    </item>');
  }
  lines.push('  </items>');
  lines.push('</price>');

  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `public, max-age=${FEED_CACHE_MAX_AGE}, s-maxage=${FEED_CACHE_MAX_AGE}`,
    },
  });
}
