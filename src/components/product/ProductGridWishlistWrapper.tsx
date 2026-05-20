'use client';

import type { ReactNode } from 'react';
import { WishlistBulkProvider } from '@/providers/WishlistBulkProvider';

interface ProductGridWishlistWrapperProps {
  productIds: number[];
  children: ReactNode;
}

/**
 * Client wrapper that gives a grid of ProductCards a single bulk wishlist fetch.
 * Use this around any list of ProductCards rendered by a server component.
 */
export default function ProductGridWishlistWrapper({
  productIds,
  children,
}: ProductGridWishlistWrapperProps) {
  return <WishlistBulkProvider productIds={productIds}>{children}</WishlistBulkProvider>;
}
