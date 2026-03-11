import { describe, it, expect } from 'vitest';
import { createShipmentSchema } from './ukrposhta';

const validShipment = {
  senderName: 'Порошок',
  senderPhone: '+380501234567',
  senderAddress: 'вул. Хрещатик 1, Київ',
  senderPostcode: '01001',
  recipientName: 'Тарас Шевченко',
  recipientPhone: '+380671234567',
  recipientAddress: 'вул. Степана Бандери 5, Львів',
  recipientPostcode: '79000',
  weight: 2.5,
  length: 30,
  width: 20,
  height: 15,
  declaredValue: 500,
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

  it('should reject weight below 0.01', () => {
    const result = createShipmentSchema.safeParse({ ...validShipment, weight: 0 });
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
      expect(createShipmentSchema.safeParse({ ...validShipment, deliveryType: dt }).success).toBe(true);
    }
  });

  it('should reject invalid delivery type', () => {
    const result = createShipmentSchema.safeParse({ ...validShipment, deliveryType: 'invalid' });
    expect(result.success).toBe(false);
  });
});
