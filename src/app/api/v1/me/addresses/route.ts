import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/middleware/auth';
import { getUserAddresses, createAddress } from '@/services/delivery-address';
import { successResponse, privateResponse, errorResponse } from '@/utils/api-response';

const createAddressSchema = z.object({
  label: z.string().max(50).optional(),
  city: z.string().min(1, 'Вкажіть місто'),
  street: z.string().optional(),
  building: z.string().optional(),
  apartment: z.string().optional(),
  postalCode: z.string().optional(),
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
