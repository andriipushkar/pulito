import { describe, it, expect } from 'vitest';
import {
  createTenantSchema,
  updateTenantSchema,
  addTenantUserSchema,
} from './tenant';

describe('tenant validators', () => {
  describe('createTenantSchema', () => {
    const validData = {
      name: 'My Store',
      slug: 'my-store',
    };

    it('should accept valid data with required fields', () => {
      const result = createTenantSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept all optional fields', () => {
      const result = createTenantSchema.safeParse({
        ...validData,
        domain: 'mystore.com',
        logoUrl: 'https://cdn.example.com/logo.png',
        primaryColor: '#FF5500',
        plan: 'pro',
        isActive: true,
      });
      expect(result.success).toBe(true);
    });

    it('should reject name shorter than 2 characters', () => {
      const result = createTenantSchema.safeParse({ ...validData, name: 'A' });
      expect(result.success).toBe(false);
    });

    it('should reject name longer than 100 characters', () => {
      const result = createTenantSchema.safeParse({ ...validData, name: 'A'.repeat(101) });
      expect(result.success).toBe(false);
    });

    it('should reject slug shorter than 2 characters', () => {
      const result = createTenantSchema.safeParse({ ...validData, slug: 'a' });
      expect(result.success).toBe(false);
    });

    it('should reject slug longer than 63 characters', () => {
      const result = createTenantSchema.safeParse({ ...validData, slug: 'a'.repeat(64) });
      expect(result.success).toBe(false);
    });

    it('should reject slug with uppercase letters', () => {
      const result = createTenantSchema.safeParse({ ...validData, slug: 'My-Store' });
      expect(result.success).toBe(false);
    });

    it('should reject slug with spaces', () => {
      const result = createTenantSchema.safeParse({ ...validData, slug: 'my store' });
      expect(result.success).toBe(false);
    });

    it('should accept slug with lowercase letters, numbers, dashes', () => {
      const result = createTenantSchema.safeParse({ ...validData, slug: 'my-store-123' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid primaryColor format', () => {
      const result = createTenantSchema.safeParse({ ...validData, primaryColor: 'red' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('#RRGGBB');
      }
    });

    it('should reject short hex color', () => {
      const result = createTenantSchema.safeParse({ ...validData, primaryColor: '#FFF' });
      expect(result.success).toBe(false);
    });

    it('should accept valid hex color', () => {
      const result = createTenantSchema.safeParse({ ...validData, primaryColor: '#ff5500' });
      expect(result.success).toBe(true);
    });

    it('should accept all valid plans', () => {
      for (const plan of ['free', 'basic', 'pro', 'enterprise']) {
        const result = createTenantSchema.safeParse({ ...validData, plan });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid plan', () => {
      const result = createTenantSchema.safeParse({ ...validData, plan: 'ultra' });
      expect(result.success).toBe(false);
    });

    it('should accept null domain', () => {
      const result = createTenantSchema.safeParse({ ...validData, domain: null });
      expect(result.success).toBe(true);
    });

    it('should accept null logoUrl', () => {
      const result = createTenantSchema.safeParse({ ...validData, logoUrl: null });
      expect(result.success).toBe(true);
    });

    // Note: z.record(z.unknown()) has a known issue in Zod v4, skipping settings test

    it('should reject missing required fields', () => {
      const result = createTenantSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('updateTenantSchema', () => {
    it('should accept partial data', () => {
      const result = updateTenantSchema.safeParse({ name: 'Updated Store' });
      expect(result.success).toBe(true);
    });

    it('should accept empty object', () => {
      const result = updateTenantSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate field constraints on update', () => {
      const result = updateTenantSchema.safeParse({ primaryColor: 'invalid' });
      expect(result.success).toBe(false);
    });
  });

  describe('addTenantUserSchema', () => {
    it('should accept valid data', () => {
      const result = addTenantUserSchema.safeParse({ userId: 1 });
      expect(result.success).toBe(true);
    });

    it('should accept optional role', () => {
      const result = addTenantUserSchema.safeParse({ userId: 1, role: 'admin' });
      expect(result.success).toBe(true);
    });

    it('should accept all valid roles', () => {
      for (const role of ['owner', 'admin', 'member']) {
        const result = addTenantUserSchema.safeParse({ userId: 1, role });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid role', () => {
      const result = addTenantUserSchema.safeParse({ userId: 1, role: 'superadmin' });
      expect(result.success).toBe(false);
    });

    it('should reject non-positive userId', () => {
      const result = addTenantUserSchema.safeParse({ userId: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject negative userId', () => {
      const result = addTenantUserSchema.safeParse({ userId: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject missing userId', () => {
      const result = addTenantUserSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
