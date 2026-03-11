import { prisma } from '@/lib/prisma';

export class QuickOrderError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'QuickOrderError';
  }
}

interface QuickOrderLine {
  code: string;
  quantity: number;
}

interface ResolvedLine {
  code: string;
  requestedQuantity: number;
  productId: number | null;
  productName: string | null;
  productSlug: string | null;
  priceRetail: number | null;
  priceWholesale: number | null;
  priceWholesale2: number | null;
  priceWholesale3: number | null;
  availableQuantity: number | null;
  imagePath: string | null;
  status: 'found' | 'not_found' | 'insufficient_stock';
}

export function parseQuickOrderInput(input: string): QuickOrderLine[] {
  const lines = input.trim().split('\n').filter(Boolean);
  const result: QuickOrderLine[] = [];

  for (const line of lines) {
    const parts = line.trim().split(/[\t;,\s]+/);
    if (parts.length < 2) continue;

    const code = parts[0].trim();
    const quantity = parseInt(parts[parts.length - 1], 10);

    if (code && !isNaN(quantity) && quantity > 0) {
      result.push({ code, quantity });
    }
  }

  return result;
}

export async function resolveQuickOrder(lines: QuickOrderLine[]): Promise<ResolvedLine[]> {
  if (lines.length === 0) {
    throw new QuickOrderError('Не вказано жодного товару');
  }

  const codes = lines.map((l) => l.code);

  const products = await prisma.product.findMany({
    where: { code: { in: codes }, isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      slug: true,
      priceRetail: true,
      priceWholesale: true,
      priceWholesale2: true,
      priceWholesale3: true,
      quantity: true,
      imagePath: true,
    },
  });

  const productMap = new Map(products.map((p) => [p.code, p]));

  return lines.map((line) => {
    const product = productMap.get(line.code);

    if (!product) {
      return {
        code: line.code,
        requestedQuantity: line.quantity,
        productId: null,
        productName: null,
        productSlug: null,
        priceRetail: null,
        priceWholesale: null,
        priceWholesale2: null,
        priceWholesale3: null,
        availableQuantity: null,
        imagePath: null,
        status: 'not_found' as const,
      };
    }

    const hasStock = product.quantity >= line.quantity;

    return {
      code: line.code,
      requestedQuantity: line.quantity,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      priceRetail: Number(product.priceRetail),
      priceWholesale: product.priceWholesale != null ? Number(product.priceWholesale) : null,
      priceWholesale2: product.priceWholesale2 != null ? Number(product.priceWholesale2) : null,
      priceWholesale3: product.priceWholesale3 != null ? Number(product.priceWholesale3) : null,
      availableQuantity: product.quantity,
      imagePath: product.imagePath,
      status: hasStock ? ('found' as const) : ('insufficient_stock' as const),
    };
  });
}
