import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env before import
vi.mock('@/config/env', () => ({
  env: { UKRPOSHTA_BEARER_TOKEN: 'test-token' },
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
      })
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
    it('should create shipment successfully', async () => {
      const { createShipment } = await import('./ukrposhta');

      const mockShipment = {
        uuid: 'uuid-123',
        barcode: '0503300045006',
        sender: { name: 'Sender', phone: '+380991111111' },
        recipient: { name: 'Recipient', phone: '+380992222222' },
        declaredPrice: 500,
        weight: 1000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockShipment,
      });

      const result = await createShipment({
        senderName: 'Sender',
        senderPhone: '+380991111111',
        senderAddress: 'Address 1',
        senderPostcode: '01001',
        recipientName: 'Recipient',
        recipientPhone: '+380992222222',
        recipientAddress: 'Address 2',
        recipientPostcode: '02002',
        weight: 1000,
        length: 30,
        width: 20,
        height: 10,
        declaredValue: 500,
      });

      expect(result.uuid).toBe('uuid-123');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/shipments'),
        expect.objectContaining({ method: 'POST' })
      );

      // Verify deliveryType defaults to W2W
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.deliveryType).toBe('W2W');
      expect(body.description).toBe('');
    });

    it('should use custom deliveryType and description', async () => {
      const { createShipment } = await import('./ukrposhta');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uuid: 'uuid-456' }),
      });

      await createShipment({
        senderName: 'S',
        senderPhone: '+380991111111',
        senderAddress: 'A1',
        senderPostcode: '01001',
        recipientName: 'R',
        recipientPhone: '+380992222222',
        recipientAddress: 'A2',
        recipientPostcode: '02002',
        weight: 500,
        length: 10,
        width: 10,
        height: 10,
        declaredValue: 100,
        deliveryType: 'D2D',
        description: 'Fragile',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.deliveryType).toBe('D2D');
      expect(body.description).toBe('Fragile');
    });

    it('should throw on API error with 502 for server errors', async () => {
      const { createShipment, UkrposhtaError } = await import('./ukrposhta');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      try {
        await createShipment({
          senderName: 'S',
          senderPhone: '+380991111111',
          senderAddress: 'A1',
          senderPostcode: '01001',
          recipientName: 'R',
          recipientPhone: '+380992222222',
          recipientAddress: 'A2',
          recipientPostcode: '02002',
          weight: 500,
          length: 10,
          width: 10,
          height: 10,
          declaredValue: 100,
        });
      } catch (e) {
        expect(e).toBeInstanceOf(UkrposhtaError);
        expect((e as InstanceType<typeof UkrposhtaError>).statusCode).toBe(502);
      }
    });

    it('should handle text() failure gracefully', async () => {
      const { createShipment, UkrposhtaError } = await import('./ukrposhta');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => { throw new Error('fail'); },
      });

      try {
        await createShipment({
          senderName: 'S',
          senderPhone: '+380991111111',
          senderAddress: 'A1',
          senderPostcode: '01001',
          recipientName: 'R',
          recipientPhone: '+380992222222',
          recipientAddress: 'A2',
          recipientPostcode: '02002',
          weight: 500,
          length: 10,
          width: 10,
          height: 10,
          declaredValue: 100,
        });
      } catch (e) {
        expect(e).toBeInstanceOf(UkrposhtaError);
        expect((e as InstanceType<typeof UkrposhtaError>).statusCode).toBe(400);
      }
    });

    it('should throw when token not configured', async () => {
      const { env } = await import('@/config/env');
      const original = env.UKRPOSHTA_BEARER_TOKEN;
      (env as unknown as Record<string, string>).UKRPOSHTA_BEARER_TOKEN = '';

      const { createShipment } = await import('./ukrposhta');
      await expect(
        createShipment({
          senderName: 'S',
          senderPhone: '+380991111111',
          senderAddress: 'A1',
          senderPostcode: '01001',
          recipientName: 'R',
          recipientPhone: '+380992222222',
          recipientAddress: 'A2',
          recipientPostcode: '02002',
          weight: 500,
          length: 10,
          width: 10,
          height: 10,
          declaredValue: 100,
        })
      ).rejects.toThrow('Ukrposhta API token not configured');

      (env as unknown as Record<string, string>).UKRPOSHTA_BEARER_TOKEN = original;
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
        expect.stringContaining('/shipments/uuid-123/label'),
        expect.objectContaining({
          headers: expect.objectContaining({ Accept: 'application/pdf' }),
        })
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
});
