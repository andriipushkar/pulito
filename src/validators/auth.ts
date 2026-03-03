import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Невалідний email'),
  password: z
    .string()
    .min(8, 'Пароль має бути мінімум 8 символів')
    .max(128, 'Пароль має бути максимум 128 символів'),
  fullName: z
    .string()
    .min(2, "Ім'я має бути мінімум 2 символи")
    .max(100, "Ім'я має бути максимум 100 символів"),
  phone: z.string().regex(/^\+380\d{9}$/, 'Невірний формат телефону').optional().or(z.literal('')),
  referralCode: z.string().optional(),
  companyName: z.string().max(200, 'Назва компанії має бути максимум 200 символів').optional(),
  edrpou: z
    .string()
    .regex(/^\d{8}$/, 'ЄДРПОУ має містити рівно 8 цифр')
    .optional()
    .or(z.literal('')),
});

export const loginSchema = z.object({
  email: z.string().email('Невалідний email'),
  password: z.string().min(1, "Пароль обов'язковий"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
