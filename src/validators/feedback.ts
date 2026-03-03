import { z } from 'zod';

export const contactFormSchema = z.object({
  name: z.string().min(2, 'Мінімум 2 символи'),
  email: z.string().email('Невірний формат email'),
  phone: z.string().regex(/^\+380\d{9}$/, 'Невірний формат телефону').optional().or(z.literal('')),
  subject: z.string().max(200).optional(),
  message: z.string().min(10, 'Мінімум 10 символів').max(2000),
  website: z.string().max(0, 'Spam detected').optional(),
});

export const callbackRequestSchema = z.object({
  name: z.string().min(2, 'Мінімум 2 символи'),
  phone: z.string().regex(/^\+380\d{9}$/, 'Введіть коректний номер телефону'),
  message: z.string().max(500).optional().default('Запит на зворотний дзвінок'),
  website: z.string().max(0, 'Spam detected').optional(),
});

export const feedbackFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['form', 'callback']).optional(),
  status: z.enum(['new_feedback', 'processed', 'rejected']).optional(),
});

export const updateFeedbackStatusSchema = z.object({
  status: z.enum(['processed', 'rejected']),
});

export const subscribeSchema = z.object({
  email: z.string().email('Невірний формат email'),
  source: z.string().max(50).optional(),
});
