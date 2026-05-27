import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { buildHreflang } from '@/lib/i18n';

// Sitemap reads from the live DB; CI builds with a stub DATABASE_URL,
// so prerendering at build time fails. Compute on request, cached at runtime.
export const dynamic = 'force-dynamic';

const PRODUCTS_PER_SITEMAP = 5000;

/**
 * Sitemap index: returns links to sub-sitemaps when product count exceeds
 * PRODUCTS_PER_SITEMAP, otherwise returns a single flat sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';

  const productCount = await prisma.product.count({ where: { isActive: true } });
  const chunks = Math.ceil(productCount / PRODUCTS_PER_SITEMAP) || 1;

  // Static pages — every URL gets hreflang alternates so Google sees the
  // /uk and /en variants point at the same conceptual page.
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      changeFrequency: 'daily',
      priority: 1,
      alternates: { languages: buildHreflang('/') },
    },
    {
      url: `${baseUrl}/catalog`,
      changeFrequency: 'daily',
      priority: 0.9,
      alternates: { languages: buildHreflang('/catalog') },
    },
    {
      url: `${baseUrl}/blog`,
      changeFrequency: 'daily',
      priority: 0.7,
      alternates: { languages: buildHreflang('/blog') },
    },
    {
      url: `${baseUrl}/news`,
      changeFrequency: 'daily',
      priority: 0.7,
      alternates: { languages: buildHreflang('/news') },
    },
    {
      url: `${baseUrl}/bundles`,
      changeFrequency: 'weekly',
      priority: 0.6,
      alternates: { languages: buildHreflang('/bundles') },
    },
    {
      url: `${baseUrl}/faq`,
      changeFrequency: 'weekly',
      priority: 0.5,
      alternates: { languages: buildHreflang('/faq') },
    },
    {
      url: `${baseUrl}/contacts`,
      changeFrequency: 'monthly',
      priority: 0.4,
      alternates: { languages: buildHreflang('/contacts') },
    },
  ];

  // Categories (usually small, always in main sitemap)
  const categories = await prisma.category.findMany({
    where: { isVisible: true, deletedAt: null },
    select: { slug: true, updatedAt: true },
  });

  const categoryPages: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${baseUrl}/catalog?category=${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
    alternates: { languages: buildHreflang(`/catalog?category=${c.slug}`) },
  }));

  // Brands — each has a dedicated /brand/[slug] SEO page.
  const brands = await prisma.brand.findMany({
    where: { isVisible: true, deletedAt: null },
    select: { slug: true, updatedAt: true },
  });

  const brandPages: MetadataRoute.Sitemap = brands.map((b) => ({
    url: `${baseUrl}/brand/${b.slug}`,
    lastModified: b.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
    alternates: { languages: buildHreflang(`/brand/${b.slug}`) },
  }));

  // Static content pages
  const pages = await prisma.staticPage.findMany({
    where: { isPublished: true },
    select: { slug: true, updatedAt: true },
  });

  const contentPages: MetadataRoute.Sitemap = pages.map((p) => ({
    url: `${baseUrl}/pages/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.5,
    alternates: { languages: buildHreflang(`/pages/${p.slug}`) },
  }));

  // Products — chunked to avoid timeout on large catalogs
  const allProductPages: MetadataRoute.Sitemap = [];
  for (let i = 0; i < chunks; i++) {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      orderBy: { id: 'asc' },
      skip: i * PRODUCTS_PER_SITEMAP,
      take: PRODUCTS_PER_SITEMAP,
    });

    for (const p of products) {
      allProductPages.push({
        url: `${baseUrl}/product/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.8,
        alternates: { languages: buildHreflang(`/product/${p.slug}`) },
      });
    }
  }

  // Blog posts
  const blogPosts = await prisma.blogPost.findMany({
    where: { isPublished: true },
    select: { slug: true, updatedAt: true },
    orderBy: { publishedAt: 'desc' },
  });

  const blogPages: MetadataRoute.Sitemap = blogPosts.map((p) => ({
    url: `${baseUrl}/blog/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
    alternates: { languages: buildHreflang(`/blog/${p.slug}`) },
  }));

  // Blog categories — listing pages for each topic, indexed separately
  // so users searching "блог про прибирання" land on the right hub.
  const blogCategories = await prisma.blogCategory.findMany({
    select: { slug: true, updatedAt: true },
  });

  const blogCategoryPages: MetadataRoute.Sitemap = blogCategories.map((c) => ({
    url: `${baseUrl}/blog/category/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.5,
    alternates: { languages: buildHreflang(`/blog/category/${c.slug}`) },
  }));

  // Bundles
  const bundles = await prisma.bundle.findMany({
    where: { isActive: true },
    select: { slug: true, updatedAt: true },
  });

  const bundlePages: MetadataRoute.Sitemap = bundles.map((b) => ({
    url: `${baseUrl}/bundles/${b.slug}`,
    lastModified: b.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
    alternates: { languages: buildHreflang(`/bundles/${b.slug}`) },
  }));

  return [
    ...staticPages,
    ...allProductPages,
    ...categoryPages,
    ...brandPages,
    ...contentPages,
    ...blogPages,
    ...blogCategoryPages,
    ...bundlePages,
  ];
}

/**
 * Generate sitemap index for very large sites.
 * Next.js can use this via sitemap/[id]/route.ts pattern.
 */
export async function generateSitemapChunkCount(): Promise<number> {
  const productCount = await prisma.product.count({ where: { isActive: true } });
  return Math.ceil(productCount / PRODUCTS_PER_SITEMAP) || 1;
}
