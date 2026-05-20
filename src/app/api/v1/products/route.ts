import { NextRequest } from 'next/server';
import { productFilterSchema } from '@/validators/product';
import { getProducts } from '@/services/product';
import { paginatedResponse, errorResponse } from '@/utils/api-response';
import { createApiHandler } from '@/lib/api-handler';
import { RATE_LIMITS } from '@/services/rate-limit';
import { verifyAccessToken } from '@/services/token';

// Best-effort detection of the requester's role for B2B price gating. We
// don't require auth (the endpoint is public), but if a valid bearer is
// present we honour it so wholesalers see their tier prices.
function readRoleFromAuth(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = verifyAccessToken(header.slice(7));
    return payload.role ?? null;
  } catch {
    return null;
  }
}

// Strip B2B wholesale fields from a product row when the requester isn't
// allowed to see them. Wholesalers, managers and admins keep them; everyone
// else (anonymous + retail clients) gets retail only.
function stripWholesaleIfNotAllowed<T extends Record<string, unknown>>(p: T, role: string | null) {
  if (role === 'wholesaler' || role === 'admin' || role === 'manager') return p;
  const {
    priceWholesale: _w1,
    priceWholesale2: _w2,
    priceWholesale3: _w3,
    priceWholesaleOld: _wo,
    priceWholesaleOld2: _wo2,
    priceWholesaleOld3: _wo3,
    ...rest
  } = p as Record<string, unknown>;
  void _w1; void _w2; void _w3; void _wo; void _wo2; void _wo3;
  return rest as T;
}

export const GET = createApiHandler(RATE_LIMITS.api, async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const raw = {
      page: sp.get('page') ?? undefined,
      limit: sp.get('limit') ?? undefined,
      category: sp.get('category') ?? undefined,
      search: sp.get('search') ?? undefined,
      priceMin: sp.get('price_min') ?? undefined,
      priceMax: sp.get('price_max') ?? undefined,
      promo: sp.get('promo') ?? undefined,
      inStock: sp.get('in_stock') ?? undefined,
      sort: sp.get('sort') ?? undefined,
    };

    const parsed = productFilterSchema.safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Невалідні параметри';
      return errorResponse(firstError, 422);
    }

    const role = readRoleFromAuth(request);
    const { products, total } = await getProducts(parsed.data);
    const safeProducts = products.map((p) => stripWholesaleIfNotAllowed(p, role));
    return paginatedResponse(safeProducts, total, parsed.data.page, parsed.data.limit);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
