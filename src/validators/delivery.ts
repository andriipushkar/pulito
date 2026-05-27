import { z } from 'zod';

export const deliveryEstimateSchema = z.object({
  method: z.enum(['nova_poshta', 'ukrposhta']),
  city: z.string().optional(),
  total: z.coerce.number().min(0),
  // Weight in KILOGRAMS. Nova Poshta's smallest billed parcel is 0.5 kg —
  // anything smaller is rounded up to 0.5 on their side, so we clamp here so
  // the cost estimate the customer sees matches what they'll actually be
  // charged. Default 1 kg covers typical small e-com packages.
  weight: z.coerce.number().min(0.5).default(1),
});

export type DeliveryEstimateInput = z.infer<typeof deliveryEstimateSchema>;
