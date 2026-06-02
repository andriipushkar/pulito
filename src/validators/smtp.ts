import { z } from 'zod';

// Coerce numeric strings — `<input type=number>` browsers send strings, but
// we want a real number internally. `boolean()` lets the UI send `true`/`false`
// (string) and still produces a boolean after `z.coerce`.
export const updateSmtpSettingsSchema = z.object({
  smtp_host: z.string().min(1).max(255).optional(),
  smtp_port: z.coerce.number().int().min(1).max(65535).optional(),
  smtp_user: z.string().max(255).optional(),
  smtp_pass: z.string().max(500).optional(),
  smtp_from: z.string().email('Невалідний email').max(255).optional(),
  smtp_from_name: z.string().max(100).optional(),
  smtp_secure: z.coerce.boolean().optional(),
  max_file_size_mb: z.coerce.number().int().min(1).max(100).optional(),
});

export const smtpTestSchema = z.object({
  config: z.object({
    host: z.string().min(1).max(255),
    port: z.coerce.number().int().min(1).max(65535),
    // The UI sends '' when the secure checkbox was never toggled (no stored
    // value yet). Normalise empty/undefined to 'false' so an untouched
    // checkbox doesn't fail the union with a generic "Invalid input".
    secure: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? 'false' : v),
      z.union([z.boolean(), z.literal('true'), z.literal('false')]),
    ),
    user: z.string().max(255).optional(),
    pass: z.string().max(500).optional(),
    from: z.string().email().max(255).optional(),
    fromName: z.string().max(100).optional(),
  }),
  testEmail: z.string().email().max(255).optional(),
});
