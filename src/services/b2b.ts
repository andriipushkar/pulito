import { prisma } from '@/lib/prisma';

export class B2BError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'B2BError';
  }
}

interface BulkOrderItem {
  code: string;
  quantity: number;
}

interface ResolvedItem {
  productId: number;
  code: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  available: number;
}

/**
 * Resolve bulk order items by product codes.
 * Validates availability and returns pricing for wholesale user.
 */
export async function resolveBulkOrder(
  items: BulkOrderItem[],
  wholesaleGroup: number | null
): Promise<{ items: ResolvedItem[]; totalAmount: number; errors: string[] }> {
  const codes = items.map((i) => i.code.trim().toUpperCase());

  const products = await prisma.product.findMany({
    where: {
      code: { in: codes },
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      code: true,
      name: true,
      quantity: true,
      priceRetail: true,
      priceWholesale: true,
      priceWholesale2: true,
      priceWholesale3: true,
    },
  });

  const productMap = new Map(products.map((p) => [p.code.toUpperCase(), p]));
  const resolved: ResolvedItem[] = [];
  const errors: string[] = [];

  for (const item of items) {
    const code = item.code.trim().toUpperCase();
    const product = productMap.get(code);

    if (!product) {
      errors.push(`Товар з кодом "${item.code}" не знайдено`);
      continue;
    }

    if (product.quantity < item.quantity) {
      errors.push(`Товар "${product.name}" (${product.code}): доступно ${product.quantity}, запитано ${item.quantity}`);
    }

    // Resolve wholesale price
    let price = Number(product.priceRetail);
    if (wholesaleGroup === 1 && product.priceWholesale) price = Number(product.priceWholesale);
    if (wholesaleGroup === 2 && product.priceWholesale2) price = Number(product.priceWholesale2);
    if (wholesaleGroup === 3 && product.priceWholesale3) price = Number(product.priceWholesale3);

    resolved.push({
      productId: product.id,
      code: product.code,
      name: product.name,
      quantity: item.quantity,
      price,
      total: Math.round(price * item.quantity * 100) / 100,
      available: product.quantity,
    });
  }

  const totalAmount = Math.round(resolved.reduce((sum, i) => sum + i.total, 0) * 100) / 100;

  return { items: resolved, totalAmount, errors };
}

/**
 * Check if user has available credit for deferred payment.
 */
export async function checkCreditLimit(userId: number, amount: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditLimit: true, creditUsed: true },
  });

  if (!user?.creditLimit) return false;

  const available = Number(user.creditLimit) - Number(user.creditUsed || 0);
  return available >= amount;
}

/**
 * Use credit for a deferred payment order.
 */
export async function useCreditForOrder(userId: number, amount: number): Promise<void> {
  const hasCredit = await checkCreditLimit(userId, amount);
  if (!hasCredit) {
    throw new B2BError('Недостатній кредитний ліміт');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { creditUsed: { increment: amount } },
  });
}
