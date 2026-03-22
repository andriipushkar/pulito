import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

const PRODUCTS_PER_SITEMAP = 5000;

/**
 * Sitemap index: returns links to sub-sitemaps when product count exceeds
 * PRODUCTS_PER_SITEMAP, otherwise returns a single flat sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';

  const productCount = await prisma.product.count({ where: { isActive: true } });
  const chunks = Math.ceil(productCount / PRODUCTS_PER_SITEMAP) || 1;

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/catalog`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/blog`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/bundles`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${baseUrl}/calculator`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/faq`, changeFrequency: 'weekly', priority: 0.5 },
  ];

  // Categories (usually small, always in main sitemap)
  const categories = await prisma.category.findMany({
    where: { isVisible: true },
    select: { slug: true, updatedAt: true },
  });

  const categoryPages: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${baseUrl}/catalog?category=${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
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
  }));

  return [...staticPages, ...allProductPages, ...categoryPages, ...contentPages, ...blogPages, ...bundlePages];
}

/**
 * Generate sitemap index for very large sites.
 * Next.js can use this via sitemap/[id]/route.ts pattern.
 */
export async function generateSitemapChunkCount(): Promise<number> {
  const productCount = await prisma.product.count({ where: { isActive: true } });
  return Math.ceil(productCount / PRODUCTS_PER_SITEMAP) || 1;
}
