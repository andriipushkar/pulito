import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Пароль має бути мінімум 8 символів')
  .max(128, 'Пароль має бути максимум 128 символів')
  .refine(
    (val) =>
      /[A-Z]/.test(val) &&
      /[a-z]/.test(val) &&
      /\d/.test(val) &&
      /[!@#$%^&*()_+\-=\[\]{}|;:',.<>?/]/.test(val),
    { message: 'Пароль повинен містити великі та малі літери, цифру та спеціальний символ' },
  );

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Невалідний email')
  .max(254, 'Email задовгий');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z
    .string()
    .trim()
    .min(2, "Ім'я має бути мінімум 2 символи")
    .max(100, "Ім'я має бути максимум 100 символів"),
  phone: z
    .string()
    .regex(/^\+380\d{9}$/, 'Невірний формат телефону')
    .optional()
    .or(z.literal('')),
  referralCode: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{6,16}$/, 'Невірний формат реферального коду')
    .optional()
    .or(z.literal('')),
  companyName: z
    .string()
    .trim()
    .max(200, 'Назва компанії має бути максимум 200 символів')
    .optional(),
  edrpou: z
    .string()
    .trim()
    .regex(/^\d{8}$/, 'ЄДРПОУ має містити рівно 8 цифр')
    .optional()
    .or(z.literal('')),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Пароль обов'язковий").max(128, 'Пароль задовгий'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
