import { describe, it, expect } from 'vitest';
import { createShipmentSchema } from './ukrposhta';

// Schema is nested (recipient/parcels) with weight in grams; sender is
// optional (resolved from shop delivery settings when omitted).
const validShipment = {
  recipient: {
    name: 'Тарас Шевченко',
    phone: '+380671234567',
    address: {
      postcode: '79000',
      city: 'Львів',
      street: 'вул. Степана Бандери',
      houseNumber: '5',
    },
  },
  parcels: [
    { name: 'Побутова хімія', weight: 2500, length: 30, width: 20, height: 15, declaredPrice: 500 },
  ],
};

describe('createShipmentSchema', () => {
  it('should validate correct data', () => {
    const result = createShipmentSchema.safeParse(validShipment);
    expect(result.success).toBe(true);
  });

  it('should reject missing fields', () => {
    const result = createShipmentSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject parcel weight below 1 gram', () => {
    const result = createShipmentSchema.safeParse({
      ...validShipment,
      parcels: [{ ...validShipment.parcels[0], weight: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it('should accept optional description and deliveryType', () => {
    const result = createShipmentSchema.parse({
      ...validShipment,
      description: 'Побутова хімія',
      deliveryType: 'W2W',
    });
    expect(result.description).toBe('Побутова хімія');
    expect(result.deliveryType).toBe('W2W');
  });

  it('should accept all delivery types', () => {
    for (const dt of ['W2W', 'W2D', 'D2W', 'D2D']) {
      expect(createShipmentSchema.safeParse({ ...validShipment, deliveryType: dt }).success).toBe(
        true,
      );
    }
  });

  it('should reject invalid delivery type', () => {
    const result = createShipmentSchema.safeParse({ ...validShipment, deliveryType: 'invalid' });
    expect(result.success).toBe(false);
  });
});
