import { prisma } from '@/lib/prisma';

/**
 * Category slugs for calculator recommendations.
 * These are loaded from settings if available, falling back to defaults.
 * Admin can override via settings key 'calculator_categories'.
 */
async function getCategoryMappings(): Promise<Record<string, string>> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'calculator_categories' },
    });
    if (setting?.value) {
      return JSON.parse(setting.value);
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_CATEGORY_SLUGS;
}

const DEFAULT_CATEGORY_SLUGS: Record<string, string> = {
  detergent: 'pralni-poroshky',
  conditioner: 'kondytsionery',
  dishes: 'mytya-posudu',
  cleaning: 'prybyrannya',
  bathroom: 'vannaya-tualet',
};

interface CalculatorInput {
  familySize: number;   // 1-8
  washLoadsPerWeek: number; // 1-14
  cleaningFrequency: 'daily' | 'weekly' | 'biweekly';
}

interface ProductRecommendation {
  productId: number;
  name: string;
  code: string;
  slug: string;
  imagePath: string | null;
  priceRetail: number;
  quantityPerMonth: number;
  totalCost: number;
  category: string;
}

interface CalculatorResult {
  recommendations: ProductRecommendation[];
  totalMonthly: number;
  totalQuarterly: number;
}

// Category slugs for recommendation mapping
const CATEGORY_USAGE: Record<string, (input: CalculatorInput) => number> = {
  // Пральний порошок: ~150g per load
  'pralni-poroshky': (i) => Math.ceil((i.washLoadsPerWeek * 0.15 * 4.3) / 1), // kg per month
  'pralni-zasoby': (i) => Math.ceil((i.washLoadsPerWeek * 0.15 * 4.3) / 1),
  // Кондиціонер для білизни: ~50ml per load
  'kondytsionery': (i) => Math.ceil((i.washLoadsPerWeek * 0.05 * 4.3) / 1), // L per month
  // Засоби для миття посуду: ~10ml per person per day
  'mytya-posudu': (i) => Math.ceil((i.familySize * 0.01 * 30) / 0.5), // bottles (0.5L)
  // Засоби для прибирання: based on cleaning frequency
  'prybyrannya': (i) => {
    const freqMultiplier = i.cleaningFrequency === 'daily' ? 30 : i.cleaningFrequency === 'weekly' ? 4.3 : 2.15;
    return Math.ceil((i.familySize * 0.02 * freqMultiplier) / 1);
  },
  // Засоби для ванної/туалету
  'vannaya-tualet': (i) => {
    const freqMultiplier = i.cleaningFrequency === 'daily' ? 30 : i.cleaningFrequency === 'weekly' ? 4.3 : 2.15;
    return Math.ceil(freqMultiplier / 4.3); // 1 bottle per ~month if weekly
  },
};

/**
 * Calculate household cleaning product needs based on family parameters.
 * Returns product recommendations with quantities and costs.
 */
export async function calculateNeeds(input: CalculatorInput): Promise<CalculatorResult> {
  const { familySize, washLoadsPerWeek, cleaningFrequency } = input;

  // Load configurable category mappings
  const categoryMap = await getCategoryMappings();
  const slugsToSearch = Object.values(categoryMap);

  // Get one representative product per relevant category
  const categories = await prisma.category.findMany({
    where: {
      slug: { in: slugsToSearch },
      deletedAt: null,
    },
    select: { id: true, name: true, slug: true },
  });

  const recommendations: ProductRecommendation[] = [];

  for (const cat of categories) {
    const usageFn = CATEGORY_USAGE[cat.slug];
    if (!usageFn) continue;

    const quantityPerMonth = usageFn({ familySize, washLoadsPerWeek, cleaningFrequency });
    if (quantityPerMonth <= 0) continue;

    // Get the most popular active product in this category
    const product = await prisma.product.findFirst({
      where: {
        categoryId: cat.id,
        isActive: true,
        deletedAt: null,
        quantity: { gt: 0 },
      },
      orderBy: { ordersCount: 'desc' },
      select: {
        id: true,
        name: true,
        code: true,
        slug: true,
        imagePath: true,
        priceRetail: true,
      },
    });

    if (product) {
      const price = Number(product.priceRetail);
      recommendations.push({
        productId: product.id,
        name: product.name,
        code: product.code,
        slug: product.slug,
        imagePath: product.imagePath,
        priceRetail: price,
        quantityPerMonth,
        totalCost: Math.round(price * quantityPerMonth * 100) / 100,
        category: cat.name,
      });
    }
  }

  const totalMonthly = Math.round(recommendations.reduce((sum, r) => sum + r.totalCost, 0) * 100) / 100;

  return {
    recommendations,
    totalMonthly,
    totalQuarterly: Math.round(totalMonthly * 3 * 100) / 100,
  };
}
