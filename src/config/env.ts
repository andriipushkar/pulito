import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6380/0'),

  JWT_SECRET: z.string().min(32).refine(
    (s) => new Set(s).size >= 16,
    { message: 'JWT_SECRET must have sufficient entropy (16+ unique chars)' }
  ),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('noreply@localhost'),

  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.coerce.number().default(10485760),

  // Used for cron endpoint authentication — must be cryptographically strong
  APP_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  INSTAGRAM_ACCESS_TOKEN: z.string().default(''),
  INSTAGRAM_BUSINESS_ACCOUNT_ID: z.string().default(''),
  INSTAGRAM_APP_ID: z.string().default(''),
  INSTAGRAM_APP_SECRET: z.string().default(''),

  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  NOVA_POSHTA_API_KEY: z.string().default(''),
  UKRPOSHTA_BEARER_TOKEN: z.string().default(''),
  LIQPAY_PUBLIC_KEY: z.string().default(''),
  LIQPAY_PRIVATE_KEY: z.string().default(''),
  MONOBANK_TOKEN: z.string().default(''),
  WAYFORPAY_MERCHANT_ACCOUNT: z.string().default(''),
  WAYFORPAY_SECRET_KEY: z.string().default(''),
  TELEGRAM_BOT_TOKEN: z.string().default(''),
  TELEGRAM_CHANNEL_ID: z.string().default(''),
  TELEGRAM_MANAGER_CHAT_ID: z.string().default(''),

  FACEBOOK_PAGE_ACCESS_TOKEN: z.string().default(''),
  FACEBOOK_PAGE_ID: z.string().default(''),
  TYPESENSE_HOST: z.string().default('localhost'),
  TYPESENSE_PORT: z.coerce.number().default(8108),
  TYPESENSE_API_KEY: z.string().default('ts-clean-dev-key'),
  TYPESENSE_PROTOCOL: z.enum(['http', 'https']).default('http'),
  SENTRY_DSN: z.string().default(''),
  SENTRY_ENVIRONMENT: z.string().default('production'),
  JWT_ALGORITHM: z.enum(['HS256', 'RS256']).default('HS256'),
  JWT_PRIVATE_KEY_PATH: z.string().default(''),
  JWT_PUBLIC_KEY_PATH: z.string().default(''),
  MAINTENANCE_MODE: z.enum(['true', 'false']).default('false'),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }

  // Production guards
  if (parsed.data.NODE_ENV === 'production') {
    if (parsed.data.TYPESENSE_API_KEY === 'ts-clean-dev-key') {
      console.warn('WARNING: TYPESENSE_API_KEY is using default dev key in production');
    }
  }

  return parsed.data;
}

export const env = validateEnv();
