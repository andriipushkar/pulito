import { NextRequest } from 'next/server';
import { calculateNeeds } from '@/services/calculator';
import { successResponse, errorResponse } from '@/utils/api-response';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const familySize = Math.min(8, Math.max(1, Number(searchParams.get('familySize')) || 3));
    const washLoadsPerWeek = Math.min(14, Math.max(1, Number(searchParams.get('washLoadsPerWeek')) || 4));
    const cleaningFrequency = (['daily', 'weekly', 'biweekly'].includes(searchParams.get('cleaningFrequency') || '')
      ? searchParams.get('cleaningFrequency')!
      : 'weekly') as 'daily' | 'weekly' | 'biweekly';

    const result = await calculateNeeds({ familySize, washLoadsPerWeek, cleaningFrequency });
    return successResponse(result);
  } catch {
    return errorResponse('Помилка розрахунку', 500);
  }
}
