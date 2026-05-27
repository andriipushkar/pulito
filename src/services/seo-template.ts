import { prisma } from '@/lib/prisma';

export class SeoTemplateError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'SeoTemplateError';
  }
}

interface SeoTemplateInput {
  entityType: string;
  scope: string;
  titleTemplate: string;
  descriptionTemplate: string;
  altTemplate?: string;
  categoryId?: number;
}

export async function getSeoTemplates() {
  return prisma.seoTemplate.findMany({
    orderBy: { entityType: 'asc' },
  });
}

export async function getSeoTemplateByEntity(entityType: string, categoryId?: number) {
  return prisma.seoTemplate.findFirst({
    where: {
      entityType,
      ...(categoryId ? { categoryId } : { categoryId: null }),
    },
  });
}

/** Validate template lengths against SERP display limits (Google cuts at
 * ~70 chars for title, ~160 for description). Throw early so admin sees
 * the problem in the form, not silently in production search results. */
function validateTemplate(data: Partial<SeoTemplateInput>) {
  if (data.titleTemplate !== undefined) {
    const t = data.titleTemplate.trim();
    if (t.length === 0) throw new SeoTemplateError('Title template не може бути порожнім', 400);
    if (t.length > 200)
      throw new SeoTemplateError(
        'Title template має бути до 200 символів (з підстановкою — до 70)',
        400,
      );
  }
  if (data.descriptionTemplate !== undefined) {
    const d = data.descriptionTemplate.trim();
    if (d.length === 0)
      throw new SeoTemplateError('Description template не може бути порожнім', 400);
    if (d.length > 500)
      throw new SeoTemplateError(
        'Description template має бути до 500 символів (з підстановкою — до 160)',
        400,
      );
  }
}

export async function createSeoTemplate(data: SeoTemplateInput) {
  validateTemplate(data);
  try {
    return await prisma.seoTemplate.create({
      data: {
        entityType: data.entityType,
        scope: data.scope || 'global',
        titleTemplate: data.titleTemplate,
        descriptionTemplate: data.descriptionTemplate,
        altTemplate: data.altTemplate,
        categoryId: data.categoryId,
      },
    });
  } catch (err) {
    // P2002 = unique constraint (`@@unique([entityType, scope, categoryId])`).
    // Turn the raw Prisma error into a user-friendly 409 so the admin form
    // can show "this template already exists" instead of generic 500.
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      throw new SeoTemplateError(
        `Шаблон для entityType="${data.entityType}", scope="${data.scope || 'global'}", categoryId=${data.categoryId ?? 'null'} вже існує`,
        409,
      );
    }
    throw err;
  }
}

export async function updateSeoTemplate(id: number, data: Partial<SeoTemplateInput>) {
  const template = await prisma.seoTemplate.findUnique({ where: { id } });
  if (!template) throw new SeoTemplateError('Шаблон не знайдено', 404);
  validateTemplate(data);

  // Whitelist to prevent mass-assignment of arbitrary fields from the request body.
  const allowed: Partial<SeoTemplateInput> = {};
  if (data.entityType !== undefined) allowed.entityType = data.entityType;
  if (data.scope !== undefined) allowed.scope = data.scope;
  if (data.titleTemplate !== undefined) allowed.titleTemplate = data.titleTemplate;
  if (data.descriptionTemplate !== undefined)
    allowed.descriptionTemplate = data.descriptionTemplate;
  if (data.altTemplate !== undefined) allowed.altTemplate = data.altTemplate;
  if (data.categoryId !== undefined) allowed.categoryId = data.categoryId;

  return prisma.seoTemplate.update({
    where: { id },
    data: allowed,
  });
}

export async function deleteSeoTemplate(id: number) {
  const template = await prisma.seoTemplate.findUnique({ where: { id } });
  if (!template) throw new SeoTemplateError('Шаблон не знайдено', 404);

  return prisma.seoTemplate.delete({ where: { id } });
}

/**
 * Applies SEO template variables for a product
 * Variables: {name}, {code}, {category}, {price}, {brand}
 *
 * Substituted values are stripped of XML/HTML-significant chars (`<`, `>`,
 * `&`, `"`, `'`) so a product name like `<script>` can't break the sitemap
 * or google-shopping feed serialisers. Next.js JSX escapes the same chars
 * on the storefront, but raw XML feed endpoints emit these fields literally.
 */
export function applyProductTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    const safe = stripUnsafeChars(value);
    result = result.split(`{${key}}`).join(safe);
  }
  return result;
}

function stripUnsafeChars(s: string): string {
  return s.replace(/[<>&"']/g, '');
}

export async function generateProductSeo(productId: number) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: { select: { name: true, id: true } },
      content: { select: { id: true, seoTitle: true, seoDescription: true } },
    },
  });

  if (!product) throw new SeoTemplateError('Товар не знайдено', 404);

  // Try category-specific template first, then general product template
  const template =
    (await getSeoTemplateByEntity('product', product.category?.id)) ||
    (await getSeoTemplateByEntity('product'));

  if (!template) return null;

  const vars: Record<string, string> = {
    name: product.name,
    code: product.code,
    category: product.category?.name || '',
    price: Number(product.priceRetail).toFixed(2),
  };

  return {
    seoTitle: applyProductTemplate(template.titleTemplate, vars),
    seoDescription: applyProductTemplate(template.descriptionTemplate, vars),
    imageAlt: template.altTemplate ? applyProductTemplate(template.altTemplate, vars) : undefined,
  };
}

const BULK_BATCH_LIMIT = 100;

export async function bulkGenerateProductSeo() {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [{ content: null }, { content: { seoTitle: null } }],
    },
    include: { category: { select: { name: true, id: true } } },
    take: BULK_BATCH_LIMIT,
  });

  // Single-shot template fetch — pre-fix loop did 2 SELECTs per product
  // (category-specific + global fallback), so 100 products = 200 queries.
  // Now: one SELECT, then in-memory lookup by `categoryId`.
  const templates = await prisma.seoTemplate.findMany({
    where: { entityType: 'product' },
  });
  const templateByCategory = new Map<number | null, (typeof templates)[number]>();
  for (const t of templates) {
    templateByCategory.set(t.categoryId, t);
  }
  const globalTemplate = templateByCategory.get(null) ?? null;

  // Report remaining-without-seo so UI can show "click again to process
  // next batch" instead of silently capping at 100.
  const remaining = await prisma.product.count({
    where: {
      isActive: true,
      OR: [{ content: null }, { content: { seoTitle: null } }],
    },
  });

  let updated = 0;

  for (const product of products) {
    const template =
      (product.category?.id !== undefined && product.category.id !== null
        ? templateByCategory.get(product.category.id)
        : undefined) ?? globalTemplate;

    if (!template) continue;

    const vars: Record<string, string> = {
      name: product.name,
      code: product.code,
      category: product.category?.name || '',
      price: Number(product.priceRetail).toFixed(2),
    };

    const seoTitle = applyProductTemplate(template.titleTemplate, vars);
    const seoDescription = applyProductTemplate(template.descriptionTemplate, vars);

    await prisma.productContent.upsert({
      where: { productId: product.id },
      update: { seoTitle, seoDescription },
      create: { productId: product.id, seoTitle, seoDescription },
    });

    updated++;
  }

  return {
    updated,
    total: products.length,
    remainingWithoutSeo: Math.max(0, remaining - updated),
    batchLimit: BULK_BATCH_LIMIT,
  };
}
