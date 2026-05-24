/**
 * Renders OpenGraph Product Markup meta tags with `property=` (not `name=`).
 *
 * Why: Next.js's Metadata API renders entries under `other` with `name=` —
 * but Facebook / Telegram / Instagram require `property=` for og:type=product
 * and the product:* family of meta to be parsed. So we render them as JSX
 * <meta> elements; Next.js 15+ hoists them to <head> automatically.
 */

interface ProductOgPropertyProps {
  price: number;
  currency?: string;
  availability: 'in stock' | 'out of stock';
  condition?: 'new' | 'used' | 'refurbished';
  retailerItemId?: string | null;
}

export default function ProductOgProperty({
  price,
  currency = 'UAH',
  availability,
  condition = 'new',
  retailerItemId,
}: ProductOgPropertyProps) {
  return (
    <>
      <meta property="og:type" content="product" />
      <meta property="product:price:amount" content={price.toFixed(2)} />
      <meta property="product:price:currency" content={currency} />
      <meta property="product:availability" content={availability} />
      <meta property="product:condition" content={condition} />
      {retailerItemId && <meta property="product:retailer_item_id" content={retailerItemId} />}
    </>
  );
}
