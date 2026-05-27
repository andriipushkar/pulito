export interface ProductImage {
  id: number;
  pathOriginal?: string | null;
  pathFull: string | null;
  pathMedium: string | null;
  pathThumbnail: string | null;
  pathBlur?: string | null;
  isMain: boolean;
  altText?: string | null;
  sortOrder?: number;
}

export interface ProductBadge {
  id: number;
  badgeType: string;
  customText: string | null;
  customColor: string | null;
  priority: number;
}

// Prisma returns Decimal objects for price fields; accept any type convertible via Number()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Price = any;

export interface ProductListItem {
  id: number;
  code: string;
  name: string;
  slug: string;
  priceRetail: Price;
  priceWholesale: Price | null;
  priceWholesale2: Price | null;
  priceWholesale3: Price | null;
  priceRetailOld: Price | null;
  priceWholesaleOld: Price | null;
  quantity: number;
  hideQuantity?: boolean;
  isPromo: boolean;
  isActive: boolean;
  imagePath: string | null;
  barcode: string | null;
  viewsCount: number;
  ordersCount: number;
  createdAt: string | Date;
  category: { id: number; name: string; slug: string } | null;
  brand: { id: number; name: string; slug: string } | null;
  badges: ProductBadge[];
  images: Pick<
    ProductImage,
    'id' | 'pathFull' | 'pathMedium' | 'pathThumbnail' | 'pathBlur' | 'isMain'
  >[];
  content: { shortDescription: string | null } | null;
  // Optional aggregate rating (only present when the service includes it)
  avgRating?: number | null;
  reviewCount?: number;
  // Pre-computed on the server (serializeProduct) so the "Новинка" badge
  // matches between SSR and CSR — no one-frame flicker on hydration.
  isNew?: boolean;
}

export interface ProductContent {
  shortDescription: string | null;
  fullDescription: string | null;
  specifications: string | null;
  usageInstructions: string | null;
  videoUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isFilled: boolean;
}

export interface ProductVariantSummary {
  id: number;
  sku: string;
  name: string;
  // Server sends Prisma Decimal which serialises as string in JSON; client
  // code converts via Number() when displaying. `unknown` keeps the surface
  // permissive for the JSON round-trip.
  priceRetail: unknown;
  priceWholesale: unknown;
  quantity: number;
  options: Record<string, string> | unknown | null;
  imagePath: string | null;
  isActive: boolean;
  // Optional physical parameters — null on variants without per-variant
  // overrides (parent product's value is used in those cases).
  weightGrams?: number | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  cost?: unknown;
}

export interface ProductDetail extends Omit<ProductListItem, 'images'> {
  sortOrder: number;
  promoStartDate: string | Date | null;
  promoEndDate: string | Date | null;
  updatedAt: string | Date;
  content: ProductContent | null;
  images: ProductImage[];
  category: {
    id: number;
    name: string;
    slug: string;
    seoTitle: string | null;
    seoDescription: string | null;
  } | null;
  brand: { id: number; name: string; slug: string; logoPath?: string | null } | null;
  variants?: ProductVariantSummary[];
}
