import { z } from 'zod';

// Single source of truth for moderation rule shape. Both POST + PUT pulled
// inline string-array checks before; that drifted (POST didn't cap config
// size, PUT did). Zod schema below is the contract.

export const MODERATION_PLATFORMS = ['telegram', 'viber'] as const;
export const MODERATION_RULE_TYPES = ['stop_words', 'link_block', 'flood_limit'] as const;
export const MODERATION_ACTIONS = ['delete', 'warn', 'ban'] as const;

/** 16 KB ceiling on the rule config JSON. A sensible stop-word list is a
 * few thousand entries; anything larger is operator error or DB-bloat
 * attempt. Same limit as the existing PUT guard so POST+PUT agree. */
export const MAX_CONFIG_JSON_BYTES = 16_384;

const configSchema = z
  .record(z.string(), z.unknown())
  .refine((v) => JSON.stringify(v ?? {}).length <= MAX_CONFIG_JSON_BYTES, {
    message: `config надто великий (макс ${MAX_CONFIG_JSON_BYTES / 1024} KB)`,
  });

export const createModerationRuleSchema = z.object({
  platform: z.enum(MODERATION_PLATFORMS),
  ruleType: z.enum(MODERATION_RULE_TYPES),
  action: z.enum(MODERATION_ACTIONS),
  config: configSchema,
  isActive: z.boolean().optional().default(true),
});

export const updateModerationRuleSchema = z.object({
  platform: z.enum(MODERATION_PLATFORMS).optional(),
  ruleType: z.enum(MODERATION_RULE_TYPES).optional(),
  action: z.enum(MODERATION_ACTIONS).optional(),
  config: configSchema.optional(),
  isActive: z.boolean().optional(),
});

export const updateModerationLogSchema = z.object({
  id: z.number().int().positive(),
  isFalsePositive: z.boolean().optional().default(true),
});
