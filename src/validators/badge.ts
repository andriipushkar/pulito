import { z } from 'zod';

export const BADGE_TYPES = ['promo', 'new_arrival', 'hit', 'eco', 'custom'] as const;

// CSS named colors that are safe (subset). Anything else must be hex.
// We reject `<script>...`, `expression()`, `url(...)` etc. by allowing only
// `#rgb` / `#rrggbb` / `#rrggbbaa` or 1-32 alphanumeric letters (named color).
const CUSTOM_COLOR_REGEX = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{1,32})$/;

const customTextSchema = z.string().max(50, 'Текст бейджа до 50 символів').optional().nullable();
const customColorSchema = z
  .string()
  .max(32)
  .regex(CUSTOM_COLOR_REGEX, 'Колір має бути hex (#fff, #ffffff) або CSS-name')
  .optional()
  .nullable();

export const createBadgeSchema = z.object({
  productId: z.number().int().positive(),
  badgeType: z.enum(BADGE_TYPES),
  customText: customTextSchema,
  customColor: customColorSchema,
  priority: z.number().int().min(0).max(1000).default(0),
  isActive: z.boolean().optional().default(true),
  // Manually-created badges default to locked so the cron's cleanup doesn't
  // remove them mid-promotion. UI can override.
  isLocked: z.boolean().optional().default(true),
});

export const updateBadgeSchema = z.object({
  badgeType: z.enum(BADGE_TYPES).optional(),
  customText: customTextSchema,
  customColor: customColorSchema,
  priority: z.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
  isLocked: z.boolean().optional(),
});
