import { describe, it, expect } from 'vitest';
import {
  contactFormSchema,
  callbackRequestSchema,
  feedbackFilterSchema,
  updateFeedbackStatusSchema,
  subscribeSchema,
} from './feedback';

describe('contactFormSchema', () => {
  it('should validate correct data', () => {
    const result = contactFormSchema.safeParse({
      name: 'Тарас',
      email: 'test@test.com',
      message: 'Привіт, це тестове повідомлення',
    });
    expect(result.success).toBe(true);
  });

  it('should reject short name', () => {
    const result = contactFormSchema.safeParse({
      name: 'T',
      email: 'test@test.com',
      message: 'Привіт, це тестове повідомлення',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid email', () => {
    const result = contactFormSchema.safeParse({
      name: 'Тарас',
      email: 'invalid',
      message: 'Привіт, це тестове повідомлення',
    });
    expect(result.success).toBe(false);
  });

  it('should reject short message', () => {
    const result = contactFormSchema.safeParse({
      name: 'Тарас',
      email: 'test@test.com',
      message: 'Коротке',
    });
    expect(result.success).toBe(false);
  });

  it('should reject honeypot field with content', () => {
    const result = contactFormSchema.safeParse({
      name: 'Тарас',
      email: 'test@test.com',
      message: 'Привіт, це тестове повідомлення',
      website: 'spam',
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid phone format', () => {
    const result = contactFormSchema.safeParse({
      name: 'Тарас',
      email: 'test@test.com',
      message: 'Привіт, це тестове повідомлення',
      phone: '+380501234567',
    });
    expect(result.success).toBe(true);
  });
});

describe('callbackRequestSchema', () => {
  it('should validate correct callback request', () => {
    const result = callbackRequestSchema.safeParse({
      name: 'Тарас',
      phone: '+380501234567',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid phone', () => {
    const result = callbackRequestSchema.safeParse({
      name: 'Тарас',
      phone: '123',
    });
    expect(result.success).toBe(false);
  });
});

describe('feedbackFilterSchema', () => {
  it('should apply defaults', () => {
    const result = feedbackFilterSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('should accept valid filters', () => {
    const result = feedbackFilterSchema.parse({
      page: 2,
      limit: 50,
      type: 'form',
      status: 'processed',
    });
    expect(result.type).toBe('form');
    expect(result.status).toBe('processed');
  });
});

describe('updateFeedbackStatusSchema', () => {
  it('should accept processed', () => {
    expect(updateFeedbackStatusSchema.parse({ status: 'processed' })).toEqual({ status: 'processed' });
  });

  it('should reject invalid status', () => {
    expect(updateFeedbackStatusSchema.safeParse({ status: 'invalid' }).success).toBe(false);
  });
});

describe('subscribeSchema', () => {
  it('should validate email subscription', () => {
    const result = subscribeSchema.parse({ email: 'test@test.com' });
    expect(result.email).toBe('test@test.com');
  });

  it('should reject invalid email', () => {
    expect(subscribeSchema.safeParse({ email: 'bad' }).success).toBe(false);
  });
});
