import { z } from 'zod';

// The admin form PUTs the WHOLE settings object, including fields the user
// never touched, which arrive as empty strings ('') from the loaded state.
// An empty string must mean "leave this key unchanged" — NOT "coerce to 0 and
// fail .min(1)" (that produced "Too small: expected number to be >=1" on save
// when the optional max_file_size_mb field was blank). `emptyToUndefined`
// normalises '' / null to undefined so `.optional()` skips the field cleanly.
const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const opt = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(emptyToUndefined, schema.optional());

// Coerce numeric strings — `<input type=number>` browsers send strings, but
// we want a real number internally. `boolean()` lets the UI send `true`/`false`
// (string) and still produces a boolean after `z.coerce`.
export const updateSmtpSettingsSchema = z.object({
  smtp_host: opt(z.string().min(1).max(255)),
  smtp_port: opt(z.coerce.number().int().min(1).max(65535)),
  smtp_user: opt(z.string().max(255)),
  smtp_pass: opt(z.string().max(500)),
  smtp_from: opt(z.string().email('Невалідний email').max(255)),
  smtp_from_name: opt(z.string().max(100)),
  // The checkbox sends the STRINGS 'true'/'false'. `z.coerce.boolean('false')`
  // would wrongly yield `true` (any non-empty string is truthy), saving secure
  // inverted. Parse the string explicitly instead.
  smtp_secure: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v === true || v === 'true'),
    z.boolean().optional(),
  ),
  max_file_size_mb: opt(z.coerce.number().int().min(1).max(100)),
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
