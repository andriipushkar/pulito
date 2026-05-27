/**
 * One-shot backfill: fill empty blogPost.seoTitle / seoDescription using the
 * same derivation logic createPost/updatePost use at runtime (title + plain-
 * text content/excerpt, trimmed to SERP limits). Skips posts that already
 * have both fields filled in.
 *
 * Usage:  npx tsx scripts/backfill-blog-seo.ts
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const SEO_TITLE_MAX = 70;
const SEO_DESCRIPTION_MAX = 160;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1).trimEnd();
  const lastSpace = slice.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${base}…`;
}

function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const posts = await prisma.blogPost.findMany({
    where: {
      OR: [{ seoTitle: null }, { seoTitle: '' }, { seoDescription: null }, { seoDescription: '' }],
    },
    select: {
      id: true,
      title: true,
      excerpt: true,
      content: true,
      seoTitle: true,
      seoDescription: true,
    },
  });

  if (posts.length === 0) {
    console.log('Усі статті блогу вже мають заповнені seoTitle/seoDescription.');
    return;
  }

  console.log(`Знайдено ${posts.length} статей без повного SEO. Оновлюю…`);

  let done = 0;
  for (const post of posts) {
    const needsTitle = !post.seoTitle?.trim();
    const needsDesc = !post.seoDescription?.trim();
    if (!needsTitle && !needsDesc) continue;

    const data: { seoTitle?: string; seoDescription?: string } = {};
    if (needsTitle) {
      data.seoTitle = truncate(post.title.trim(), SEO_TITLE_MAX);
    }
    if (needsDesc) {
      const source = post.excerpt ? plainText(post.excerpt) : plainText(post.content);
      data.seoDescription = truncate(source, SEO_DESCRIPTION_MAX);
    }
    await prisma.blogPost.update({ where: { id: post.id }, data });
    done += 1;
    if (done % 20 === 0) console.log(`  …${done}/${posts.length}`);
  }

  console.log(`Готово. Оновлено ${done} статей.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
