import { describe, it, expect } from 'vitest';
import { createTTNSchema } from './nova-poshta';

const validTTN = {
  senderRef: 'ref-1',
  senderAddressRef: 'addr-1',
  senderContactRef: 'contact-1',
  senderPhone: '+380501234567',
  recipientName: 'Тарас Шевченко',
  recipientPhone: '+380671234567',
  recipientCityRef: 'city-ref-1',
  weight: 1.5,
  description: 'Побутова хімія',
  cost: 500,
};

describe('createTTNSchema', () => {
  it('should validate correct data', () => {
    const result = createTTNSchema.safeParse(validTTN);
    expect(result.success).toBe(true);
  });

  it('should apply defaults', () => {
    const result = createTTNSchema.parse(validTTN);
    expect(result.payerType).toBe('Sender');
    expect(result.paymentMethod).toBe('Cash');
    expect(result.cargoType).toBe('Parcel');
    expect(result.seatsAmount).toBe(1);
    expect(result.serviceType).toBe('WarehouseWarehouse');
  });

  it('should reject missing required fields', () => {
    const result = createTTNSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject zero weight', () => {
    const result = createTTNSchema.safeParse({ ...validTTN, weight: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject zero cost', () => {
    const result = createTTNSchema.safeParse({ ...validTTN, cost: 0 });
    expect(result.success).toBe(false);
  });

  it('should accept all service types', () => {
    for (const st of ['WarehouseWarehouse', 'WarehouseDoors', 'DoorsWarehouse', 'DoorsDoors']) {
      expect(createTTNSchema.safeParse({ ...validTTN, serviceType: st }).success).toBe(true);
    }
  });
});
