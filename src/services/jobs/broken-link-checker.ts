import { prisma } from '@/lib/prisma';

// SEO length recommendations (Google guidance; deviations are warnings, not errors)
const SEO_TITLE_MIN = 30;
const SEO_TITLE_MAX = 60;
const SEO_DESC_MIN = 70;
const SEO_DESC_MAX = 160;
const MAX_CHAIN_HOPS = 10;

// Content quality thresholds — tuned for e-commerce product descriptions.
const THIN_CONTENT_MIN_CHARS = 200;
const SLUG_MAX_LENGTH = 75;
// "Healthy" slug: lowercase ASCII letters, digits, single dashes, no leading/trailing dash.
const SLUG_HEALTHY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface OrphanedRedirect {
  id: number;
  oldSlug: string;
  newSlug: string;
  type: string;
}
export interface RedirectChain {
  id: number;
  type: string;
  hops: string[]; // oldSlug → next → next ... → finalSlug
  finalSlug: string;
}
export interface SeoGap {
  id: number;
  name: string;
  slug: string;
  type: 'product' | 'category';
  missingTitle: boolean;
  missingDescription: boolean;
  titleLength: number;
  descLength: number;
  warnings: ('title_too_short' | 'title_too_long' | 'desc_too_short' | 'desc_too_long')[];
}
export interface DuplicateSeoTitle {
  title: string;
  count: number;
  examples: { id: number; type: 'product' | 'category'; name: string; slug: string }[];
}

export interface ImageGap {
  id: number;
  name: string;
  slug: string;
  issue: 'no_images' | 'no_main_image' | 'missing_alt_text';
  imagesWithoutAlt: number; // populated only for missing_alt_text
}
export interface ThinContentItem {
  id: number;
  name: string;
  slug: string;
  charCount: number;
}
export interface SlugIssue {
  id: number;
  name: string;
  slug: string;
  type: 'product' | 'category';
  reasons: (
    | 'uppercase'
    | 'non_ascii'
    | 'special_chars'
    | 'too_long'
    | 'leading_or_trailing_dash'
  )[];
}

export interface BrokenLinkReport {
  orphanedRedirects: OrphanedRedirect[];
  redirectChains: RedirectChain[];
  seoGaps: SeoGap[];
  seoGapsTotal: number;
  duplicateTitles: DuplicateSeoTitle[];
  imageGaps: ImageGap[];
  imageGapsTotal: number;
  thinContent: ThinContentItem[];
  thinContentTotal: number;
  slugIssues: SlugIssue[];
  slugIssuesTotal: number;
  generatedAt: string;
}

export interface CheckOptions {
  /** Cap the seoGaps array returned (the total count is reported separately). */
  seoGapsLimit?: number;
  /** Same idea for the new content checks. */
  contentChecksLimit?: number;
}

/**
 * Detect SEO/redirect health issues across the catalog. All scans run as bulk
 * queries (no N+1) so this stays fast even with thousands of slugs.
 */
export async function checkBrokenLinks(options: CheckOptions = {}): Promise<BrokenLinkReport> {
  const seoGapsLimit = options.seoGapsLimit ?? 50;
  const contentChecksLimit = options.contentChecksLimit ?? 50;

  const [allRedirects, products, categories] = await Promise.all([
    prisma.slugRedirect.findMany(),
    prisma.product.findMany({
      where: { isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        content: {
          select: {
            seoTitle: true,
            seoDescription: true,
            fullDescription: true,
            shortDescription: true,
          },
        },
        images: { select: { id: true, altText: true, isMain: true } },
      },
    }),
    // Only visible, non-deleted categories: hidden/soft-deleted ones aren't
    // indexed, so flagging their missing SEO is noise (e.g. the deleted
    // "Цукерки" test category kept showing up).
    prisma.category.findMany({
      where: { isVisible: true, deletedAt: null },
      select: { id: true, name: true, slug: true, seoTitle: true, seoDescription: true },
    }),
  ]);

  const productSlugs = new Set(products.map((p) => p.slug));
  const categorySlugs = new Set(categories.map((c) => c.slug));

  // ─── Orphaned redirects ────────────────────────────────────────────────
  const orphanedRedirects: OrphanedRedirect[] = [];
  for (const r of allRedirects) {
    const targetSet =
      r.type === 'product' ? productSlugs : r.type === 'category' ? categorySlugs : null;
    if (!targetSet) continue;
    if (!targetSet.has(r.newSlug)) {
      orphanedRedirects.push({ id: r.id, oldSlug: r.oldSlug, newSlug: r.newSlug, type: r.type });
    }
  }

  // ─── Redirect chains (multi-hop) ───────────────────────────────────────
  // Walk each chain by following oldSlug → newSlug → next oldSlug ... up to
  // MAX_CHAIN_HOPS. Anything longer than 1 hop is reported (one extra hop means
  // a 301 → 301, which crawlers penalize).
  const byOldSlug = new Map(allRedirects.map((r) => [r.oldSlug, r]));
  const redirectChains: RedirectChain[] = [];
  for (const start of allRedirects) {
    const hops: string[] = [start.oldSlug];
    let current = start;
    const visited = new Set<string>([start.oldSlug]);
    let hopCount = 0;
    while (hopCount < MAX_CHAIN_HOPS) {
      const next = byOldSlug.get(current.newSlug);
      if (!next || visited.has(next.oldSlug)) break;
      hops.push(next.oldSlug);
      visited.add(next.oldSlug);
      current = next;
      hopCount++;
    }
    if (hops.length > 1) {
      redirectChains.push({
        id: start.id,
        type: start.type,
        hops: [...hops, current.newSlug],
        finalSlug: current.newSlug,
      });
    }
  }

  // ─── SEO gaps ──────────────────────────────────────────────────────────
  const allGaps: SeoGap[] = [];

  for (const p of products) {
    const title = p.content?.seoTitle ?? '';
    const desc = p.content?.seoDescription ?? '';
    const gap = evaluateGap(p.id, p.name, p.slug, 'product', title, desc);
    if (gap) allGaps.push(gap);
  }
  for (const c of categories) {
    const gap = evaluateGap(
      c.id,
      c.name,
      c.slug,
      'category',
      c.seoTitle ?? '',
      c.seoDescription ?? '',
    );
    if (gap) allGaps.push(gap);
  }

  // ─── Duplicate SEO titles ──────────────────────────────────────────────
  const titleBuckets = new Map<string, DuplicateSeoTitle['examples']>();
  for (const p of products) {
    const t = p.content?.seoTitle?.trim();
    if (!t) continue;
    const bucket = titleBuckets.get(t) ?? [];
    bucket.push({ id: p.id, type: 'product', name: p.name, slug: p.slug });
    titleBuckets.set(t, bucket);
  }
  for (const c of categories) {
    const t = c.seoTitle?.trim();
    if (!t) continue;
    const bucket = titleBuckets.get(t) ?? [];
    bucket.push({ id: c.id, type: 'category', name: c.name, slug: c.slug });
    titleBuckets.set(t, bucket);
  }
  const duplicateTitles: DuplicateSeoTitle[] = [];
  for (const [title, examples] of titleBuckets) {
    if (examples.length > 1) {
      duplicateTitles.push({ title, count: examples.length, examples: examples.slice(0, 5) });
    }
  }
  duplicateTitles.sort((a, b) => b.count - a.count);

  // ─── Image gaps ────────────────────────────────────────────────────────
  // Three classes: no images at all, has images but no "main" flag, has
  // images but some lack alt text. Hierarchy is reported as the most severe
  // single label per product so the list isn't noisy.
  const imageGapsAll: ImageGap[] = [];
  for (const p of products) {
    if (p.images.length === 0) {
      imageGapsAll.push({
        id: p.id,
        name: p.name,
        slug: p.slug,
        issue: 'no_images',
        imagesWithoutAlt: 0,
      });
      continue;
    }
    if (!p.images.some((img) => img.isMain)) {
      imageGapsAll.push({
        id: p.id,
        name: p.name,
        slug: p.slug,
        issue: 'no_main_image',
        imagesWithoutAlt: 0,
      });
      continue;
    }
    const noAlt = p.images.filter((img) => !img.altText?.trim()).length;
    if (noAlt > 0) {
      imageGapsAll.push({
        id: p.id,
        name: p.name,
        slug: p.slug,
        issue: 'missing_alt_text',
        imagesWithoutAlt: noAlt,
      });
    }
  }

  // ─── Thin content ──────────────────────────────────────────────────────
  // Description is the body Google indexes; a 30-char "Розмір: 1 л" tells
  // search engines nothing about the product. Threshold is conservative.
  const thinContentAll: ThinContentItem[] = [];
  for (const p of products) {
    const body = (p.content?.fullDescription ?? '').trim();
    if (body.length < THIN_CONTENT_MIN_CHARS) {
      thinContentAll.push({ id: p.id, name: p.name, slug: p.slug, charCount: body.length });
    }
  }
  thinContentAll.sort((a, b) => a.charCount - b.charCount);

  // ─── Slug quality ──────────────────────────────────────────────────────
  // Bad slugs (Cyrillic, uppercase, special chars, very long) hurt CTR and
  // produce ugly URLs in SERP.
  const slugIssuesAll: SlugIssue[] = [];
  const evalSlug = (
    id: number,
    name: string,
    slug: string,
    type: 'product' | 'category',
  ): SlugIssue | null => {
    const reasons: SlugIssue['reasons'] = [];
    if (/[A-Z]/.test(slug)) reasons.push('uppercase');

    if (/[^\x00-\x7f]/.test(slug)) reasons.push('non_ascii');
    if (/[^a-zA-Z0-9-]/.test(slug)) reasons.push('special_chars');
    if (slug.length > SLUG_MAX_LENGTH) reasons.push('too_long');
    if (slug.startsWith('-') || slug.endsWith('-') || slug.includes('--')) {
      reasons.push('leading_or_trailing_dash');
    }
    // Healthy slug short-circuit: if it matches the canonical pattern AND
    // isn't too long, we already covered every reason above. Skip the row.
    if (reasons.length === 0 && SLUG_HEALTHY_PATTERN.test(slug)) return null;
    if (reasons.length === 0) return null;
    return { id, name, slug, type, reasons };
  };
  for (const p of products) {
    const issue = evalSlug(p.id, p.name, p.slug, 'product');
    if (issue) slugIssuesAll.push(issue);
  }
  for (const c of categories) {
    const issue = evalSlug(c.id, c.name, c.slug, 'category');
    if (issue) slugIssuesAll.push(issue);
  }

  return {
    orphanedRedirects,
    redirectChains,
    seoGaps: allGaps.slice(0, seoGapsLimit),
    seoGapsTotal: allGaps.length,
    duplicateTitles,
    imageGaps: imageGapsAll.slice(0, contentChecksLimit),
    imageGapsTotal: imageGapsAll.length,
    thinContent: thinContentAll.slice(0, contentChecksLimit),
    thinContentTotal: thinContentAll.length,
    slugIssues: slugIssuesAll.slice(0, contentChecksLimit),
    slugIssuesTotal: slugIssuesAll.length,
    generatedAt: new Date().toISOString(),
  };
}

function evaluateGap(
  id: number,
  name: string,
  slug: string,
  type: 'product' | 'category',
  title: string,
  desc: string,
): SeoGap | null {
  const titleTrim = title.trim();
  const descTrim = desc.trim();
  const warnings: SeoGap['warnings'] = [];
  if (titleTrim && titleTrim.length < SEO_TITLE_MIN) warnings.push('title_too_short');
  if (titleTrim && titleTrim.length > SEO_TITLE_MAX) warnings.push('title_too_long');
  if (descTrim && descTrim.length < SEO_DESC_MIN) warnings.push('desc_too_short');
  if (descTrim && descTrim.length > SEO_DESC_MAX) warnings.push('desc_too_long');

  const missingTitle = !titleTrim;
  const missingDescription = !descTrim;

  // Skip the row entirely when everything is fine. Otherwise return the issue.
  if (!missingTitle && !missingDescription && warnings.length === 0) return null;

  return {
    id,
    name,
    slug,
    type,
    missingTitle,
    missingDescription,
    titleLength: titleTrim.length,
    descLength: descTrim.length,
    warnings,
  };
}

/**
 * Run the broken link checker and notify admin via Telegram if issues found.
 * Used by the cron job and exposed for ad-hoc runs.
 */
export async function runBrokenLinkChecker(): Promise<BrokenLinkReport> {
  const report = await checkBrokenLinks();

  const totalIssues =
    report.orphanedRedirects.length +
    report.redirectChains.length +
    report.seoGapsTotal +
    report.duplicateTitles.length +
    report.imageGapsTotal +
    report.thinContentTotal +
    report.slugIssuesTotal;
  if (totalIssues === 0) return report;

  const chatId = process.env.TELEGRAM_MANAGER_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !botToken) return report;

  const lines: string[] = [`🔗 <b>SEO: Виявлено ${totalIssues} проблем</b>`, ''];

  if (report.orphanedRedirects.length) {
    lines.push(`❌ Битих редіректів: ${report.orphanedRedirects.length}`);
    for (const r of report.orphanedRedirects.slice(0, 5)) {
      lines.push(`  • ${r.oldSlug} → ${r.newSlug} (${r.type})`);
    }
  }
  if (report.redirectChains.length) {
    lines.push(`🔄 Ланцюгів редіректів: ${report.redirectChains.length}`);
    for (const r of report.redirectChains.slice(0, 5)) {
      lines.push(`  • ${r.hops.join(' → ')}`);
    }
  }
  if (report.seoGapsTotal) {
    lines.push(`📝 Без SEO-контенту: ${report.seoGapsTotal}`);
    for (const g of report.seoGaps.slice(0, 5)) {
      const issues = [
        g.missingTitle && 'no title',
        g.missingDescription && 'no description',
        ...g.warnings,
      ]
        .filter(Boolean)
        .join(', ');
      lines.push(`  • ${g.name} (${g.type}) — ${issues}`);
    }
  }
  if (report.duplicateTitles.length) {
    lines.push(`👬 Дублікатів title: ${report.duplicateTitles.length}`);
    for (const d of report.duplicateTitles.slice(0, 3)) {
      lines.push(`  • "${d.title}" — ${d.count}×`);
    }
  }
  if (report.imageGapsTotal) {
    lines.push(`🖼 Проблем із зображеннями: ${report.imageGapsTotal}`);
  }
  if (report.thinContentTotal) {
    lines.push(`📭 Тонкого контенту: ${report.thinContentTotal}`);
  }
  if (report.slugIssuesTotal) {
    lines.push(`🔗 Поганих slug'ів: ${report.slugIssuesTotal}`);
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
