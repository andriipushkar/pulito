import { z } from 'zod';

const addressSchema = z.object({
  postcode: z.string().min(5).max(10),
  region: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  city: z.string().min(1).max(100),
  street: z.string().max(150).optional(),
  houseNumber: z.string().max(20).optional(),
  apartmentNumber: z.string().max(20).optional(),
});

const partySchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().min(10).max(20),
  address: addressSchema,
});

const parcelSchema = z.object({
  name: z.string().max(120).optional(),
  // Ukrposhta eCom weight unit is grams; dimensions in cm.
  weight: z.number().min(1).max(30000),
  length: z.number().min(1).max(2000).optional(),
  width: z.number().min(1).max(2000).optional(),
  height: z.number().min(1).max(2000).optional(),
  declaredPrice: z.number().min(0),
});

// Sender is optional on the request body — it may be resolved from delivery
// settings (configured shop sender) when omitted. See resolveSenderUuid().
export const createShipmentSchema = z.object({
  sender: partySchema.optional(),
  senderClientUuid: z.string().uuid().optional(),
  recipient: partySchema,
  parcels: z.array(parcelSchema).min(1).max(50),
  deliveryType: z.enum(['W2W', 'W2D', 'D2W', 'D2D']).optional(),
  description: z.string().max(255).optional(),
  codAmount: z.number().min(0).optional(),
  paidByRecipient: z.boolean().optional(),
});

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
