import { prisma } from '@/lib/prisma';

interface BrokenLinkReport {
  orphanedRedirects: { id: number; oldSlug: string; newSlug: string; type: string }[];
  redirectChains: { id: number; oldSlug: string; newSlug: string; type: string; finalSlug: string }[];
  seoGaps: { id: number; name: string; slug: string; type: 'product' | 'category' }[];
}

/**
 * Find all SlugRedirect entries where newSlug no longer exists in the target table,
 * detect redirect chains, and find products/categories with empty SEO content.
 */
export async function checkBrokenLinks(): Promise<BrokenLinkReport> {
  const allRedirects = await prisma.slugRedirect.findMany();

  // Check orphaned redirects — newSlug doesn't exist in target table
  const orphanedRedirects: BrokenLinkReport['orphanedRedirects'] = [];
  const redirectChains: BrokenLinkReport['redirectChains'] = [];

  for (const r of allRedirects) {
    let exists = false;
    if (r.type === 'product') {
      exists = !!(await prisma.product.findFirst({ where: { slug: r.newSlug, isActive: true }, select: { id: true } }));
    } else if (r.type === 'category') {
      exists = !!(await prisma.category.findFirst({ where: { slug: r.newSlug }, select: { id: true } }));
    }

    if (!exists) {
      orphanedRedirects.push({ id: r.id, oldSlug: r.oldSlug, newSlug: r.newSlug, type: r.type });
    }

    // Check for redirect chains: newSlug is itself an oldSlug of another redirect
    const chained = allRedirects.find((other) => other.oldSlug === r.newSlug);
    if (chained) {
      redirectChains.push({
        id: r.id,
        oldSlug: r.oldSlug,
        newSlug: r.newSlug,
        type: r.type,
        finalSlug: chained.newSlug,
      });
    }
  }

  // Find products and categories with empty SEO content
  const seoGaps: BrokenLinkReport['seoGaps'] = [];

  const productsWithoutSeo = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { content: null },
        { content: { seoTitle: null } },
        { content: { seoTitle: '' } },
      ],
    },
    select: { id: true, name: true, slug: true },
    take: 50,
  });
  for (const p of productsWithoutSeo) {
    seoGaps.push({ id: p.id, name: p.name, slug: p.slug, type: 'product' });
  }

  const categoriesWithoutSeo = await prisma.category.findMany({
    where: {
      OR: [
        { seoTitle: null },
        { seoTitle: '' },
      ],
    },
    select: { id: true, name: true, slug: true },
    take: 50,
  });
  for (const c of categoriesWithoutSeo) {
    seoGaps.push({ id: c.id, name: c.name, slug: c.slug, type: 'category' });
  }

  return { orphanedRedirects, redirectChains, seoGaps };
}

/**
 * Run the broken link checker and notify admin via Telegram if issues found.
 */
export async function runBrokenLinkChecker(): Promise<BrokenLinkReport> {
  const report = await checkBrokenLinks();

  const totalIssues = report.orphanedRedirects.length + report.redirectChains.length + report.seoGaps.length;
  if (totalIssues === 0) return report;

  // Notify manager via Telegram
  const chatId = process.env.TELEGRAM_MANAGER_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !botToken) return report;

  const lines = [
    `🔗 <b>SEO: Виявлено ${totalIssues} проблем</b>`,
    '',
  ];

  if (report.orphanedRedirects.length > 0) {
    lines.push(`❌ Битих редіректів: ${report.orphanedRedirects.length}`);
    for (const r of report.orphanedRedirects.slice(0, 5)) {
      lines.push(`  • ${r.oldSlug} → ${r.newSlug} (${r.type})`);
    }
  }

  if (report.redirectChains.length > 0) {
    lines.push(`🔄 Ланцюгів редіректів: ${report.redirectChains.length}`);
    for (const r of report.redirectChains.slice(0, 5)) {
      lines.push(`  • ${r.oldSlug} → ${r.newSlug} → ${r.finalSlug}`);
    }
  }

  if (report.seoGaps.length > 0) {
    lines.push(`📝 Без SEO-контенту: ${report.seoGaps.length}`);
    for (const g of report.seoGaps.slice(0, 5)) {
      lines.push(`  • ${g.name} (${g.type})`);
    }
  }

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: Number(chatId),
        text: lines.join('\n'),
        parse_mode: 'HTML',
      }),
    });
  } catch {
    // Don't fail if notification fails
  }

  return report;
}
