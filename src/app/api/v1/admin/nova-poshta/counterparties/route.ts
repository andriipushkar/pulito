import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import {
  getCounterparties,
  getCounterpartyContactPersons,
  getCounterpartyAddresses,
  NovaPoshtaError,
} from '@/services/nova-poshta';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

// Populate the TTN form from the NP cabinet instead of hardcoded refs.
//   GET                          → list sender counterparties
//   GET ?property=Recipient      → list recipient counterparties
//   GET ?ref=<uuid>&part=contacts  → contact persons of a counterparty
//   GET ?ref=<uuid>&part=addresses → addresses of a counterparty
export const GET = withRole(
  'admin',
  'manager',
)(async (request: NextRequest) => {
  try {
    const sp = request.nextUrl.searchParams;
    const property = sp.get('property') === 'Recipient' ? 'Recipient' : 'Sender';
    const ref = sp.get('ref');
    const part = sp.get('part');

    if (ref && part === 'contacts') {
      return successResponse(await getCounterpartyContactPersons(ref));
    }
    if (ref && part === 'addresses') {
      return successResponse(await getCounterpartyAddresses(ref, property));
    }

    const page = Number(sp.get('page')) || 1;
    return successResponse(await getCounterparties(property, page));
  } catch (error) {
    if (error instanceof NovaPoshtaError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('[admin/nova-poshta/counterparties] GET failed', { error });
    return errorResponse('Внутрішня помилка сервера', 500);
  }
});
