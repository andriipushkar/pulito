import { z } from 'zod';

const RFM_SEGMENTS = [
  'champions',
  'loyal',
  'recent',
  'promising',
  'at_risk',
  'sleeping',
  'lost',
  'new',
] as const;

export const createCampaignRuleSchema = z.object({
  name: z.string().min(1, 'Назва обовʼязкова').max(255),
  rfmSegment: z.enum(RFM_SEGMENTS, { error: 'Невідомий сегмент' }),
  emailTemplateId: z.number().int().positive('Оберіть шаблон email'),
  frequency: z.enum(['once', 'weekly', 'biweekly', 'monthly']).default('once'),
  isActive: z.boolean().default(true),
});

export type CreateCampaignRuleInput = z.infer<typeof createCampaignRuleSchema>;

export const updateCampaignRuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  rfmSegment: z.enum(RFM_SEGMENTS).optional(),
  emailTemplateId: z.number().int().positive().optional(),
  frequency: z.enum(['once', 'weekly', 'biweekly', 'monthly']).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateCampaignRuleInput = z.infer<typeof updateCampaignRuleSchema>;
