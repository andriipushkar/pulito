import { z } from 'zod';

// EDRPOU: 8 digits for legal entities; ФОП uses an 10-digit "ІПН"
// (tax payer code) — admins accept both. Trim before checking length.
const edrpouRegex = /^\d{8,10}$/;

// UA mobile format used elsewhere in feedback/callback validators.
const phoneRegex = /^\+380\d{9}$/;

export const wholesaleRequestSchema = z.object({
  companyName: z.string().min(1, 'Вкажіть назву компанії').max(200),
  edrpou: z
    .string()
    .max(20)
    .refine((v) => !v || edrpouRegex.test(v), 'ЄДРПОУ має містити 8 або 10 цифр')
    .optional(),
  // Mirror Prisma enums so we don't have to cast at write time.
  ownershipType: z.enum(['fop', 'tov', 'pp', 'other']).optional(),
  taxSystem: z.enum(['with_vat', 'without_vat']).optional(),
  legalAddress: z.string().max(500).optional(),
  contactPersonName: z.string().min(1, 'Вкажіть контактну особу').max(200),
  contactPersonPhone: z
    .string()
    .regex(phoneRegex, 'Введіть коректний номер у форматі +380XXXXXXXXX'),
  wholesaleMonthlyVol: z.string().max(200).optional(),
  comment: z.string().max(2000).optional(),
});
