import { getSettings } from '@/services/settings';

export type DeliveryMethod = 'nova_poshta' | 'ukrposhta' | 'pickup' | 'pallet';

function parsePositiveNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Resolves delivery cost for an order using admin-configured rules.
 *
 * Rules:
 *  - pickup → always 0 (customer picks up themselves)
 *  - free_shipping_threshold reached → 0 (overrides per-provider cost)
 *  - nova_poshta / ukrposhta → fixed_cost from settings; empty = 0 ("auto via API")
 *  - pallet → 0 here; pallet uses its own calculator (admin/settings/pallet-delivery)
 *
 * Why 0 (and not throw) for the "auto via API" case: this is the CHECKOUT
 * estimate, before any carrier shipment exists. The real price is
 * carrier-computed and only known once the shipment is created —
 * Ukrposhta returns `deliveryPrice` on POST /shipments (see
 * services/ukrposhta.ts createShipment), and NP returns the cost on TTN
 * creation. Until then admins either set a fixed cost here or the order's
 * delivery cost is reconciled from the shipment response afterwards.
 * Returning 0 keeps order creation working; the field can be edited later.
 */
export async function calculateDeliveryCost(
  method: DeliveryMethod,
  itemsTotal: number,
): Promise<number> {
  if (method === 'pickup' || method === 'pallet') return 0;

  const settings = (await getSettings()) as unknown as Record<string, string | undefined>;

  const freeThreshold = parsePositiveNumber(settings.delivery_free_shipping_threshold);
  if (freeThreshold !== null && itemsTotal >= freeThreshold) return 0;

  const key =
    method === 'nova_poshta' ? 'delivery_nova_poshta_fixed_cost' : 'delivery_ukrposhta_fixed_cost';
  return parsePositiveNumber(settings[key]) ?? 0;
}
