import { describe, it, expect } from 'vitest';
import {
  createCampaignRuleSchema,
  updateCampaignRuleSchema,
} from './campaign';

describe('campaign validators', () => {
  describe('createCampaignRuleSchema', () => {
    const validData = {
      name: 'Champion re-engagement',
      rfmSegment: 'champions' as const,
      emailTemplateId: 1,
    };

    it('should accept valid data with required fields', () => {
      const result = createCampaignRuleSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should default frequency to "once"', () => {
      const result = createCampaignRuleSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.frequency).toBe('once');
      }
    });

    it('should default isActive to true', () => {
      const result = createCampaignRuleSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
      }
    });

    it('should accept all valid RFM segments', () => {
      const segments = ['champions', 'loyal', 'recent', 'promising', 'at_risk', 'sleeping', 'lost', 'new'];
      for (const seg of segments) {
        const result = createCampaignRuleSchema.safeParse({ ...validData, rfmSegment: seg });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid RFM segment', () => {
      const result = createCampaignRuleSchema.safeParse({ ...validData, rfmSegment: 'unknown' });
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const result = createCampaignRuleSchema.safeParse({ ...validData, name: '' });
      expect(result.success).toBe(false);
    });

    it('should reject name longer than 255 characters', () => {
      const result = createCampaignRuleSchema.safeParse({ ...validData, name: 'A'.repeat(256) });
      expect(result.success).toBe(false);
    });

    it('should reject non-positive emailTemplateId', () => {
      const result = createCampaignRuleSchema.safeParse({ ...validData, emailTemplateId: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject negative emailTemplateId', () => {
      const result = createCampaignRuleSchema.safeParse({ ...validData, emailTemplateId: -1 });
      expect(result.success).toBe(false);
    });

    it('should accept all valid frequencies', () => {
      const freqs = ['once', 'weekly', 'biweekly', 'monthly'];
      for (const freq of freqs) {
        const result = createCampaignRuleSchema.safeParse({ ...validData, frequency: freq });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid frequency', () => {
      const result = createCampaignRuleSchema.safeParse({ ...validData, frequency: 'daily' });
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const result = createCampaignRuleSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept isActive false', () => {
      const result = createCampaignRuleSchema.safeParse({ ...validData, isActive: false });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(false);
      }
    });
  });

  describe('updateCampaignRuleSchema', () => {
    it('should accept partial data', () => {
      const result = updateCampaignRuleSchema.safeParse({ name: 'Updated' });
      expect(result.success).toBe(true);
    });

    it('should accept empty object', () => {
      const result = updateCampaignRuleSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate updated fields', () => {
      const result = updateCampaignRuleSchema.safeParse({ rfmSegment: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should accept updating just isActive', () => {
      const result = updateCampaignRuleSchema.safeParse({ isActive: false });
      expect(result.success).toBe(true);
    });
  });
});
