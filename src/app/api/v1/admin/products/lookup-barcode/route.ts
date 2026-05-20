import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

// 30 days for hits — Open Food Facts data rarely changes for a given EAN.
// 7 days for misses — a missing record might get filled in by a contributor.
const CACHE_HIT_TTL = 60 * 60 * 24 * 30;
const CACHE_MISS_TTL = 60 * 60 * 24 * 7;
const CACHE_PREFIX = 'off:lookup:v1:';

const schema = z.object({
  barcode: z.string().regex(/^\d{8,14}$/, 'Штрихкод має містити 8-14 цифр'),
});

interface OffProduct {
  product_name?: string;
  product_name_uk?: string;
  product_name_en?: string;
  product_name_ru?: string;
  brands?: string;
  brands_tags?: string[];
  image_front_url?: string;
  image_url?: string;
  quantity?: string;
  categories?: string;
  categories_tags?: string[];
  ingredients_text?: string;
  countries?: string;
}

interface OffResponse {
  status: 0 | 1;
  status_verbose?: string;
  product?: OffProduct;
}

/**
 * POST /api/v1/admin/products/lookup-barcode
 *
 * Two-stage lookup:
 *  1. Check our DB — if a product with this barcode exists, return it
 *     (with `source: "local"`) so the admin can decide to open it instead
 *     of creating a duplicate.
 *  2. Otherwise call Open Food Facts (free, no auth, no quota for fair use)
 *     and translate the response into our product-form shape.
 *
 * If neither finds anything, returns `{ source: "none" }` so the UI can
 * prompt the admin to fill the form manually.
 */
export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Невалідний штрихкод', 422);
    }
    const { barcode } = parsed.data;

    // 1. Local DB lookup — prevents duplicates
    const existing = await prisma.product.findUnique({
      where: { barcode },
      select: { id: true, name: true, code: true, slug: true, imagePath: true, isActive: true },
    });
    if (existing) {
      return successResponse({
        source: 'local',
        existing,
      });
    }

    // 2. Open Food Facts lookup (with Redis cache to avoid hammering OFF)
    const cacheKey = `${CACHE_PREFIX}${barcode}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsedCache = JSON.parse(cached) as
          | { found: true; payload: Record<string, unknown> }
          | { found: false };
        if (parsedCache.found) {
          return successResponse({
            ...parsedCache.payload,
            cached: true,
          });
        }
        return successResponse({ source: 'none', barcode, cached: true });
      }
    } catch (err) {
      // Cache miss / Redis hiccup — proceed to live call
      logger.warn('[lookup-barcode] cache read failed', { barcode, error: String(err) });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
        {
          signal: controller.signal,
          headers: {
            'User-Agent': 'pulito-trade-admin/1.0 (https://pulito.trade)',
          },
        },
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data = (await res.json()) as OffResponse;
        if (data.status === 1 && data.product) {
          const p = data.product;
          const name =
            p.product_name_uk?.trim() ||
            p.product_name?.trim() ||
            p.product_name_en?.trim() ||
            p.product_name_ru?.trim() ||
            null;
          const payload = {
            source: 'open_food_facts' as const,
            barcode,
            data: {
              name,
              brand: p.brands?.split(',')[0]?.trim() || null,
              imageUrl: p.image_front_url || p.image_url || null,
              quantity: p.quantity || null,
              category: p.categories?.split(',')[0]?.trim() || null,
              countries: p.countries || null,
            },
          };
          // Fire-and-forget cache write
          redis
            .setex(cacheKey, CACHE_HIT_TTL, JSON.stringify({ found: true, payload }))
            .catch((err) => logger.warn('[lookup-barcode] cache write failed', { error: String(err) }));
          return successResponse(payload);
        }
      }
    } catch (err) {
      // Network error or timeout — fall through to "none" response
      logger.warn('[lookup-barcode] OFF call failed', { barcode, error: String(err) });
    }

    // Negative cache — short TTL so newly-added OFF entries get a chance
    redis
      .setex(cacheKey, CACHE_MISS_TTL, JSON.stringify({ found: false }))
      .catch(() => {});
    return successResponse({ source: 'none', barcode });
  } catch (err) {
    logger.error('[lookup-barcode] failed', { error: String(err) });
    return errorResponse('Внутрішня помилка', 500);
  }
});
