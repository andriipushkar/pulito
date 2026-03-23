import { NextRequest } from 'next/server';
import { calculateNeeds, calculateRoomNeeds, type RoomConfig, type RoomType } from '@/services/calculator';
import { successResponse, errorResponse } from '@/utils/api-response';

const VALID_ROOM_TYPES: RoomType[] = ['kitchen', 'bathroom', 'bedroom', 'living_room', 'hallway', 'office'];

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawRooms: unknown[] = Array.isArray(body.rooms) ? body.rooms : [];

    const rooms: RoomConfig[] = rawRooms
      .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
      .map((r) => ({
        type: (VALID_ROOM_TYPES.includes(r.type as RoomType) ? r.type : 'living_room') as RoomType,
        area: Math.min(200, Math.max(1, Number(r.area) || 15)),
        count: Math.min(10, Math.max(1, Number(r.count) || 1)),
      }));

    if (rooms.length === 0) {
      return errorResponse('Потрібно вказати хоча б одну кімнату', 400);
    }

    const result = await calculateRoomNeeds(rooms);
    return successResponse(result);
  } catch {
    return errorResponse('Помилка розрахунку', 500);
  }
}
