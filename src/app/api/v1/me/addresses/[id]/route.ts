import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/middleware/auth';
import { updateAddress, deleteAddress, AddressError } from '@/services/delivery-address';
import { successResponse, errorResponse } from '@/utils/api-response';

// Caps mirror the create schema. See ../../addresses/route.ts for rationale.
const updateAddressSchema = z.object({
  label: z.string().max(50).optional(),
  city: z.string().max(100).optional(),
  street: z.string().max(200).optional(),
  building: z.string().max(20).optional(),
  apartment: z.string().max(20).optional(),
  postalCode: z.string().max(20).optional(),
  isDefault: z.boolean().optional(),
});

export const PUT = withAuth(async (request: NextRequest, { user, params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    const body = await request.json();
    const parsed = updateAddressSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message, 422);
    }
    const address = await updateAddress(user.id, numId, parsed.data);
    return successResponse(address);
  } catch (error) {
    if (error instanceof AddressError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});

export const DELETE = withAuth(async (_request: NextRequest, { user, params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);
    await deleteAddress(user.id, numId);
    return successResponse({ message: 'Адресу видалено' });
  } catch (error) {
    if (error instanceof AddressError) return errorResponse(error.message, error.statusCode);
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
