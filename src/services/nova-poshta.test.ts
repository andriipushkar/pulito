import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({
  NOVA_POSHTA_API_KEY: 'test-api-key',
}));

vi.mock('@/config/env', () => ({
  env: mockEnv,
}));

// Mock global fetch
const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal('fetch', mockFetch);

import {
  searchCities,
  getWarehouses,
  trackParcel,
  estimateDeliveryCost,
  createInternetDocument,
  NovaPoshtaError,
} from './nova-poshta';

beforeEach(() => {
  vi.clearAllMocks();
});

function mockApiResponse(data: Record<string, unknown>[], success = true, errors: string[] = []) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ success, data, errors, warnings: [] }),
  });
}

function mockApiError(errors: string[], status = 400) {
  mockFetch.mockResolvedValueOnce({
    ok: status < 400,
    status,
    json: async () => ({ success: false, data: [], errors, warnings: [] }),
  });
}

describe('searchCities', () => {
  it('should call API with correct params and return data', async () => {
    const cities = [{ Ref: 'abc', Description: 'Київ' }];
    mockApiResponse(cities);

    const result = await searchCities('Київ');

    expect(result).toEqual(cities);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.novaposhta.ua/v2.0/json/',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"CityName":"Київ"'),
      }),
    );
  });

  it('should return empty array when API returns empty data', async () => {
    mockApiResponse([]);
    const result = await searchCities('Nonexistent');
    expect(result).toEqual([]);
  });

  it('should throw NovaPoshtaError on API failure', async () => {
    mockApiError(['City not found']);
    await expect(searchCities('???')).rejects.toThrow(NovaPoshtaError);
  });

  it('should throw when API key is not configured', async () => {
    const saved = mockEnv.NOVA_POSHTA_API_KEY;
    mockEnv.NOVA_POSHTA_API_KEY = '';
    await expect(searchCities('Київ')).rejects.toThrow('Nova Poshta API key not configured');
    mockEnv.NOVA_POSHTA_API_KEY = saved;
  });
});

describe('getWarehouses', () => {
  it('should return warehouses for a city', async () => {
    const warehouses = [{ Ref: 'wh1', Description: 'Відділення №1' }];
    mockApiResponse(warehouses);

    const result = await getWarehouses('city-ref-123');

    expect(result).toEqual(warehouses);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.methodProperties.CityRef).toBe('city-ref-123');
    expect(body.calledMethod).toBe('getWarehouses');
  });

  it('should pass search string when provided', async () => {
    mockApiResponse([]);
    await getWarehouses('city-ref', 'поштомат');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.methodProperties.FindByString).toBe('поштомат');
  });

  it('should not include FindByString when search is not provided', async () => {
    mockApiResponse([]);
    await getWarehouses('city-ref');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.methodProperties.FindByString).toBeUndefined();
  });

  it('should return empty array when no warehouses found', async () => {
    mockApiResponse([]);
    const result = await getWarehouses('empty-city');
    expect(result).toEqual([]);
  });
});

describe('trackParcel', () => {
  it('should return tracking data', async () => {
    const trackingData = [{ StatusCode: '9', Status: 'Отримано' }];
    mockApiResponse(trackingData);

    const result = await trackParcel('20450000000001');

    expect(result).toEqual(trackingData);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.modelName).toBe('TrackingDocument');
    expect(body.methodProperties.Documents[0].DocumentNumber).toBe('20450000000001');
  });

  it('should throw on API error', async () => {
    mockApiError(['Document not found']);
    await expect(trackParcel('invalid-ttn')).rejects.toThrow(NovaPoshtaError);
  });
});

describe('estimateDeliveryCost', () => {
  it('should return cost and estimated days', async () => {
    mockApiResponse([{ Cost: 85, EstimatedDeliveryDate: '25.12.2025' }]);

    const result = await estimateDeliveryCost({
      citySender: 'sender-ref',
      cityRecipient: 'recipient-ref',
      weight: 2,
      serviceType: 'WarehouseWarehouse',
      cost: 500,
    });

    expect(result).toEqual({ cost: 85, estimatedDays: '25.12.2025' });
  });

  it('should handle missing EstimatedDeliveryDate', async () => {
    mockApiResponse([{ Cost: 50 }]);

    const result = await estimateDeliveryCost({
      citySender: 'a',
      cityRecipient: 'b',
      weight: 1,
      serviceType: 'WarehouseDoors',
      cost: 100,
    });

    expect(result).toEqual({ cost: 50, estimatedDays: null });
  });

  it('should handle missing Cost field', async () => {
    mockApiResponse([{ EstimatedDeliveryDate: '01.01.2026' }]);

    const result = await estimateDeliveryCost({
      citySender: 'a',
      cityRecipient: 'b',
      weight: 1,
      serviceType: 'WarehouseWarehouse',
      cost: 100,
    });

    expect(result.cost).toBe(0);
  });

  it('should throw when API returns empty data', async () => {
    mockApiResponse([]);
    await expect(
      estimateDeliveryCost({
        citySender: 'a',
        cityRecipient: 'b',
        weight: 1,
        serviceType: 'WarehouseWarehouse',
        cost: 100,
      }),
    ).rejects.toThrow('Не вдалося розрахувати вартість доставки');
  });

  it('should pass seatsAmount defaulting to 1', async () => {
    mockApiResponse([{ Cost: 10 }]);
    await estimateDeliveryCost({
      citySender: 'a',
      cityRecipient: 'b',
      weight: 1,
      serviceType: 'WarehouseWarehouse',
      cost: 100,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.methodProperties.SeatsAmount).toBe('1');
  });

  it('should use provided seatsAmount', async () => {
    mockApiResponse([{ Cost: 20 }]);
    await estimateDeliveryCost({
      citySender: 'a',
      cityRecipient: 'b',
      weight: 5,
      serviceType: 'WarehouseWarehouse',
      cost: 100,
      seatsAmount: 3,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.methodProperties.SeatsAmount).toBe('3');
  });
});

describe('createInternetDocument', () => {
  const defaultInput = {
    senderRef: 'sender-ref',
    senderAddressRef: 'sender-addr',
    senderContactRef: 'sender-contact',
    senderPhone: '+380991234567',
    recipientName: 'Тест Тестович',
    recipientPhone: '+380997654321',
    recipientCityRef: 'city-ref',
    recipientWarehouseRef: 'wh-ref',
    payerType: 'Sender' as const,
    paymentMethod: 'NonCash' as const,
    cargoType: 'Parcel' as const,
    weight: 1.5,
    seatsAmount: 1,
    description: 'Побутова хімія',
    cost: 350,
    serviceType: 'WarehouseWarehouse' as const,
  };

  it('should return document details on success', async () => {
    mockApiResponse([
      {
        IntDocNumber: '20450000000099',
        Ref: 'doc-ref-123',
        CostOnSite: 85,
        EstimatedDeliveryDate: '28.12.2025',
      },
    ]);

    const result = await createInternetDocument(defaultInput);

    expect(result).toEqual({
      intDocNumber: '20450000000099',
      ref: 'doc-ref-123',
      costOnSite: 85,
      estimatedDeliveryDate: '28.12.2025',
    });
  });

  it('should throw when API returns empty data', async () => {
    mockApiResponse([]);
    await expect(createInternetDocument(defaultInput)).rejects.toThrow('Не вдалося створити ТТН');
  });

  it('should handle missing fields in response gracefully', async () => {
    mockApiResponse([{}]);
    const result = await createInternetDocument(defaultInput);
    expect(result).toEqual({
      intDocNumber: '',
      ref: '',
      costOnSite: 0,
      estimatedDeliveryDate: '',
    });
  });
});

describe('createInternetDocument — COD + D2D variants', () => {
  const baseInput = {
    senderRef: 'sender-ref',
    senderAddressRef: 'sender-addr',
    senderContactRef: 'sender-contact',
    senderPhone: '+380991234567',
    recipientName: 'Тест',
    recipientPhone: '+380997654321',
    recipientCityRef: 'city-ref',
    recipientWarehouseRef: 'wh-ref',
    payerType: 'Recipient' as const,
    paymentMethod: 'Cash' as const,
    cargoType: 'Parcel' as const,
    weight: 1,
    seatsAmount: 1,
    description: 'Test',
    cost: 250,
    serviceType: 'WarehouseWarehouse' as const,
  };

  it('passes BackwardDeliveryData when codAmount is set', async () => {
    mockApiResponse([{ IntDocNumber: '1', Ref: 'r' }]);
    await createInternetDocument({ ...baseInput, codAmount: 250 });
    const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(callBody.methodProperties.BackwardDeliveryData).toEqual([
      { PayerType: 'Recipient', CargoType: 'Money', RedeliveryString: '250' },
    ]);
  });

  it('omits BackwardDeliveryData when codAmount is 0/undefined', async () => {
    mockApiResponse([{ IntDocNumber: '1', Ref: 'r' }]);
    await createInternetDocument(baseInput);
    const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(callBody.methodProperties.BackwardDeliveryData).toBeUndefined();
  });

  it('passes structured address fields for D2D (WarehouseDoors)', async () => {
    mockApiResponse([{ IntDocNumber: '1', Ref: 'r' }]);
    await createInternetDocument({
      ...baseInput,
      serviceType: 'WarehouseDoors',
      recipientWarehouseRef: undefined,
      recipientStreetRef: 'street-uuid',
      recipientBuilding: '12А',
      recipientFlat: '5',
    });
    const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(callBody.methodProperties.RecipientStreet).toBe('street-uuid');
    expect(callBody.methodProperties.RecipientHouse).toBe('12А');
    expect(callBody.methodProperties.RecipientFlat).toBe('5');
    expect(callBody.methodProperties.ServiceType).toBe('WarehouseDoors');
  });

  it('does not add structured address fields for warehouse delivery', async () => {
    mockApiResponse([{ IntDocNumber: '1', Ref: 'r' }]);
    await createInternetDocument(baseInput);
    const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(callBody.methodProperties.RecipientStreet).toBeUndefined();
    expect(callBody.methodProperties.RecipientHouse).toBeUndefined();
  });
});

describe('API timeout and network errors', () => {
  it('should propagate fetch network errors', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(searchCities('Київ')).rejects.toThrow('fetch failed');
  });

  it('should propagate joined error messages from API', async () => {
    mockApiError(['Помилка 1', 'Помилка 2']);
    await expect(searchCities('test')).rejects.toThrow('Помилка 1, Помилка 2');
  });

  it('should use fallback error message when errors array is empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: false, data: [], errors: [], warnings: [] }),
    });
    await expect(searchCities('test')).rejects.toThrow('Помилка API Нової Пошти');
  });

  it('should use HTTP status code when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ success: false, data: [], errors: ['Server error'], warnings: [] }),
    });

    try {
      await searchCities('test');
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(NovaPoshtaError);
      expect((err as NovaPoshtaError).statusCode).toBe(500);
    }
  });
});
