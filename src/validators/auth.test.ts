import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from './auth';

describe('auth validators', () => {
  describe('registerSchema', () => {
    const validData = {
      email: 'user@example.com',
      password: 'SecurePass123!',
      fullName: 'Тест Юзер',
    };

    it('should accept valid registration data', () => {
      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept data with optional phone', () => {
      const result = registerSchema.safeParse({ ...validData, phone: '+380991234567' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = registerSchema.safeParse({ ...validData, email: 'not-email' });
      expect(result.success).toBe(false);
    });

    it('should reject empty email', () => {
      const result = registerSchema.safeParse({ ...validData, email: '' });
      expect(result.success).toBe(false);
    });

    it('should reject password shorter than 8 chars', () => {
      const result = registerSchema.safeParse({ ...validData, password: 'short' });
      expect(result.success).toBe(false);
    });

    it('should reject password longer than 128 chars', () => {
      const result = registerSchema.safeParse({ ...validData, password: 'a'.repeat(129) });
      expect(result.success).toBe(false);
    });

    it('should reject fullName shorter than 2 chars', () => {
      const result = registerSchema.safeParse({ ...validData, fullName: 'A' });
      expect(result.success).toBe(false);
    });

    it('should reject fullName longer than 100 chars', () => {
      const result = registerSchema.safeParse({ ...validData, fullName: 'A'.repeat(101) });
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const result = registerSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    const validData = {
      email: 'user@example.com',
      password: 'SecurePass123!',
    };

    it('should accept valid login data', () => {
      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({ ...validData, email: 'bad' });
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({ ...validData, password: '' });
      expect(result.success).toBe(false);
    });

    it('should reject missing fields', () => {
      const result = loginSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
