import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/middleware/auth';
import { getUserAddresses, createAddress } from '@/services/delivery-address';
import { checkRateLimit, RATE_LIMITS } from '@/services/rate-limit';
import { successResponse, privateResponse, errorResponse } from '@/utils/api-response';

// Per-field length caps: pre-fix code only capped `label`. Realistic
// addresses fit in 200 chars; 500-byte strings in city would otherwise
// happily land in the DB and the Nova Poshta payload.
const createAddressSchema = z.object({
  label: z.string().max(50).optional(),
  city: z.string().min(1, 'Вкажіть місто').max(100),
  street: z.string().max(200).optional(),
  building: z.string().max(20).optional(),
  apartment: z.string().max(20).optional(),
  postalCode: z.string().max(20).optional(),
  isDefault: z.boolean().optional(),
});

export const GET = withAuth(async (_request: NextRequest, { user }) => {
  try {
    const addresses = await getUserAddresses(user.id);
    return privateResponse(addresses);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    const rl = await checkRateLimit(`user:${user.id}`, RATE_LIMITS.cart);
    if (!rl.allowed) return errorResponse('Забагато запитів', 429);

    const body = await request.json();
    const parsed = createAddressSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }
    const address = await createAddress(user.id, parsed.data);
    return successResponse(address, 201);
  } catch {
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
