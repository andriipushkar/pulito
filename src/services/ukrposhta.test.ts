import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env before import
vi.mock('@/config/env', () => ({
  env: { UKRPOSHTA_BEARER_TOKEN: 'test-token', UKRPOSHTA_COUNTERPARTY_TOKEN: 'cp-token' },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ukrposhta service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should track parcel successfully', async () => {
    const { trackParcel } = await import('./ukrposhta');

    const mockResponse = {
      barcode: '0503300045006',
      step: 8,
      date: '2024-01-15T14:30:00',
      name: 'Доставлено',
      event: '41',
      eventName: 'Вручення',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await trackParcel('0503300045006');
    expect(result.barcode).toBe('0503300045006');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('barcode=0503300045006'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('should throw on 404', async () => {
    const { trackParcel, UkrposhtaError } = await import('./ukrposhta');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(trackParcel('invalid')).rejects.toThrow(UkrposhtaError);
  });

  it('should throw on server error with 502 status', async () => {
    const { trackParcel, UkrposhtaError } = await import('./ukrposhta');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    try {
      await trackParcel('barcode');
    } catch (e) {
      expect(e).toBeInstanceOf(UkrposhtaError);
      expect((e as InstanceType<typeof UkrposhtaError>).statusCode).toBe(502);
    }
  });

  it('should throw on client error with original status', async () => {
    const { trackParcel, UkrposhtaError } = await import('./ukrposhta');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
    });

    try {
      await trackParcel('barcode');
    } catch (e) {
      expect(e).toBeInstanceOf(UkrposhtaError);
      expect((e as InstanceType<typeof UkrposhtaError>).statusCode).toBe(429);
    }
  });

  describe('UkrposhtaError', () => {
    it('should create error with default status code', async () => {
      const { UkrposhtaError } = await import('./ukrposhta');
      const err = new UkrposhtaError('test');
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe('UkrposhtaError');
    });

    it('should create error with custom status code', async () => {
      const { UkrposhtaError } = await import('./ukrposhta');
      const err = new UkrposhtaError('test', 502);
      expect(err.statusCode).toBe(502);
    });
  });

  describe('trackParcel without token', () => {
    it('should throw when token not configured', async () => {
      const { env } = await import('@/config/env');
      const original = env.UKRPOSHTA_BEARER_TOKEN;
      (env as unknown as Record<string, string>).UKRPOSHTA_BEARER_TOKEN = '';

      const { trackParcel } = await import('./ukrposhta');
      await expect(trackParcel('barcode')).rejects.toThrow('Ukrposhta API token not configured');

      (env as unknown as Record<string, string>).UKRPOSHTA_BEARER_TOKEN = original;
    });
  });

  describe('createShipment', () => {
    const baseInput = {
      senderClientUuid: '11111111-1111-1111-1111-111111111111',
      recipient: {
        name: 'Recipient',
        phone: '+380992222222',
        address: { postcode: '02002', city: 'Київ' },
      },
      parcels: [{ weight: 1000, length: 30, declaredPrice: 500 }],
    };

    // The real flow is multi-step: recipient address → recipient client →
    // shipment. Queue one mock response per call.
    function mockFlow(shipment: Record<string, unknown>) {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 42 }) }); // address
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ uuid: 'rcpt-uuid' }) }); // client
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => shipment }); // shipment
    }

    it('creates a shipment via address→client→shipment and returns deliveryPrice', async () => {
      const { createShipment } = await import('./ukrposhta');
      mockFlow({ uuid: 'uuid-123', barcode: '0503300045006', deliveryPrice: 55 });

      const result = await createShipment(baseInput as never);

      expect(result.uuid).toBe('uuid-123');
      expect(result.deliveryPrice).toBe(55);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      const shipCall = mockFetch.mock.calls[2];
      expect(shipCall[0]).toContain('/shipments');
      expect(shipCall[0]).toContain('token='); // second-token query param
      const body = JSON.parse(shipCall[1].body);
      expect(body.deliveryType).toBe('W2W');
      expect(body.sender.uuid).toBe(baseInput.senderClientUuid);
      expect(body.recipient.uuid).toBe('rcpt-uuid');
      expect(body.description).toBe('');
    });

    it('sends COD postPay and custom deliveryType/description', async () => {
      const { createShipment } = await import('./ukrposhta');
      mockFlow({ uuid: 'x', barcode: 'b', deliveryPrice: 10 });

      await createShipment({
        ...baseInput,
        deliveryType: 'D2D',
        description: 'Fragile',
        codAmount: 1200,
      } as never);

      const body = JSON.parse(mockFetch.mock.calls[2][1].body);
      expect(body.deliveryType).toBe('D2D');
      expect(body.description).toBe('Fragile');
      expect(body.postPay).toBe(1200);
      expect(body.paidByRecipient).toBe(true);
    });

    it('throws 502 on server error', async () => {
      const { createShipment } = await import('./ukrposhta');
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });
      await expect(createShipment(baseInput as never)).rejects.toMatchObject({ statusCode: 502 });
    });

    it('handles text() failure gracefully', async () => {
      const { createShipment } = await import('./ukrposhta');
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => {
          throw new Error('fail');
        },
      });
      await expect(createShipment(baseInput as never)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws when bearer token not configured', async () => {
      const { env } = await import('@/config/env');
      const original = env.UKRPOSHTA_BEARER_TOKEN;
      (env as unknown as Record<string, string>).UKRPOSHTA_BEARER_TOKEN = '';

      const { createShipment } = await import('./ukrposhta');
      await expect(createShipment(baseInput as never)).rejects.toThrow(
        'Ukrposhta API token not configured',
      );

      (env as unknown as Record<string, string>).UKRPOSHTA_BEARER_TOKEN = original;
    });

    it('throws when counterparty token missing (client step)', async () => {
      const { env } = await import('@/config/env');
      const original = env.UKRPOSHTA_COUNTERPARTY_TOKEN;
      (env as unknown as Record<string, string>).UKRPOSHTA_COUNTERPARTY_TOKEN = '';

      const { createShipment } = await import('./ukrposhta');
      // address creation (no token) succeeds, then client creation needs token
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 1 }) });
      await expect(createShipment(baseInput as never)).rejects.toThrow('токен контрагента');

      (env as unknown as Record<string, string>).UKRPOSHTA_COUNTERPARTY_TOKEN = original;
    });
  });

  describe('getShipmentLabel', () => {
    it('should return label buffer', async () => {
      const { getShipmentLabel } = await import('./ukrposhta');

      const pdfBytes = new Uint8Array([37, 80, 68, 70]).buffer;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => pdfBytes,
      });

      const result = await getShipmentLabel('uuid-123');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/shipments/uuid-123/sticker'),
        expect.objectContaining({
          headers: expect.objectContaining({ Accept: 'application/pdf' }),
        }),
      );
    });

    it('should throw on error response', async () => {
      const { getShipmentLabel, UkrposhtaError } = await import('./ukrposhta');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      try {
        await getShipmentLabel('invalid-uuid');
      } catch (e) {
        expect(e).toBeInstanceOf(UkrposhtaError);
        expect((e as InstanceType<typeof UkrposhtaError>).statusCode).toBe(404);
      }
    });

    it('should throw when token not configured', async () => {
      const { env } = await import('@/config/env');
      const original = env.UKRPOSHTA_BEARER_TOKEN;
      (env as unknown as Record<string, string>).UKRPOSHTA_BEARER_TOKEN = '';

      const { getShipmentLabel } = await import('./ukrposhta');
      await expect(getShipmentLabel('uuid')).rejects.toThrow('Ukrposhta API token not configured');

      (env as unknown as Record<string, string>).UKRPOSHTA_BEARER_TOKEN = original;
    });
  });

  describe('searchCities (address-classifier)', () => {
    it('returns deduped cities with name + postcode + region', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          Entries: {
            Entry: [
              { CITY_UA: 'Київ', CITY_ID: 1, POSTCODE: '01001', REGION_UA: 'Київська' },
              { CITY_UA: 'Київ', CITY_ID: 1, POSTCODE: '01001', REGION_UA: 'Київська' }, // dupe
              { CITY_UA: 'Львів', CITY_ID: 2, POSTCODE: '79000', REGION_UA: 'Львівська' },
            ],
          },
        }),
      });
      const { searchCities } = await import('./ukrposhta');
      const result = await searchCities('Кий');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'Київ',
        postcode: '01001',
        region: 'Київська',
        cityId: '1',
      });
    });

    it('returns empty array on short query', async () => {
      const { searchCities } = await import('./ukrposhta');
      expect(await searchCities('а')).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns empty array when API returns no entries', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
      const { searchCities } = await import('./ukrposhta');
      const result = await searchCities('Невідомо');
      expect(result).toEqual([]);
    });

    it('throws UkrposhtaError on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
      const { searchCities, UkrposhtaError } = await import('./ukrposhta');
      await expect(searchCities('Київ')).rejects.toThrow(UkrposhtaError);
    });

    it('caps results at 25', async () => {
      const entries = Array.from({ length: 30 }, (_, i) => ({
        CITY_UA: `Місто ${i}`,
        POSTCODE: `${i}00`,
        REGION_UA: 'Тест',
      }));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ Entries: { Entry: entries } }),
      });
      const { searchCities } = await import('./ukrposhta');
      const result = await searchCities('Місто');
      expect(result).toHaveLength(25);
    });
  });

  describe('estimateDeliveryCost', () => {
    it('uses the stateless /domestic/delivery-price endpoint (no token, no /shipments)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ deliveryPrice: 55 }),
      });
      const { estimateDeliveryCost } = await import('./ukrposhta');
      const cost = await estimateDeliveryCost({
        weight: 1000,
        declaredPrice: 500,
        senderPostcode: '79000',
        recipientPostcode: '01001',
      });
      expect(cost).toBe(55);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/domestic/delivery-price');
      expect(url).not.toContain('/shipments');
      expect(url).not.toContain('token=');
      const body = JSON.parse(opts.body);
      expect(body.weight).toBe(1000);
      expect(body.declaredPrice).toBe(500);
      expect(body.addressFrom.postcode).toBe('79000');
      expect(body.addressTo.postcode).toBe('01001');
    });

    it('returns null without calling the API when postcodes are missing', async () => {
      const { estimateDeliveryCost } = await import('./ukrposhta');
      const cost = await estimateDeliveryCost({ weight: 1000, declaredPrice: 500 });
      expect(cost).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns null when the API cannot price it', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'bad' });
      const { estimateDeliveryCost } = await import('./ukrposhta');
      const cost = await estimateDeliveryCost({
        weight: 1000,
        declaredPrice: 500,
        senderPostcode: '79000',
        recipientPostcode: '01001',
      });
      expect(cost).toBeNull();
    });
  });

  describe('getPostOfficesByCityId', () => {
    it('maps post offices from the address classifier', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          Entries: {
            Entry: [
              {
                POSTINDEX: 79000,
                PO_LONG: 'Відділення №1',
                ADDRESS: 'вул. Січова, 1',
                TYPE_LONG: 'ВПЗ',
              },
            ],
          },
        }),
      });
      const { getPostOfficesByCityId } = await import('./ukrposhta');
      const result = await getPostOfficesByCityId('123');
      expect(result[0]).toEqual({
        postcode: '79000',
        name: 'Відділення №1',
        address: 'вул. Січова, 1',
        type: 'ВПЗ',
      });
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('get_postoffices_by_city_id?city_id=123');
    });

    it('returns [] for blank cityId without calling the API', async () => {
      const { getPostOfficesByCityId } = await import('./ukrposhta');
      expect(await getPostOfficesByCityId('  ')).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('cancelShipment', () => {
    it('DELETEs the shipment by uuid', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
      const { cancelShipment } = await import('./ukrposhta');
      await cancelShipment('uuid-1');
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/shipments/uuid-1');
      expect(opts.method).toBe('DELETE');
    });

    it('throws on failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 409, text: async () => 'too late' });
      const { cancelShipment } = await import('./ukrposhta');
      await expect(cancelShipment('uuid-1')).rejects.toThrow();
    });
  });
});
