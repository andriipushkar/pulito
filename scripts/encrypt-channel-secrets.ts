/**
 * One-shot migration: walk every siteSetting row whose key starts with
 * `channel_` and encrypt sensitive credential fields (apiKey, apiSecret,
 * accessToken, refreshToken, botToken, etc.) in place.
 *
 * Idempotent — values already in encrypted form are skipped.
 *
 *   npx tsx scripts/encrypt-channel-secrets.ts
 */
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma';
import { encrypt, isEncrypted } from '../src/lib/encryption';

const SENSITIVE_FIELDS = new Set([
  'apiKey',
  'apiSecret',
  'apiToken',
  'accessToken',
  'refreshToken',
  'clientSecret',
  'password',
  'botToken',
  'authToken',
  'pageAccessToken',
  'appSecret',
]);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { startsWith: 'channel_' } },
  });

  let scanned = 0;
  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    scanned++;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(row.value);
    } catch {
      console.warn(`[skip] ${row.key}: not valid JSON`);
      skipped++;
      continue;
    }

    let touched = false;
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v !== 'string' || v.length === 0) continue;
      if (!SENSITIVE_FIELDS.has(k)) continue;
      if (isEncrypted(v)) continue;
      parsed[k] = encrypt(v);
      touched = true;
    }

    if (!touched) {
      skipped++;
      continue;
    }

    await prisma.siteSetting.update({
      where: { key: row.key },
      data: { value: JSON.stringify(parsed) },
    });
    migrated++;
    console.log(`[ok]   ${row.key}: encrypted`);
  }

  console.log(`\nScanned: ${scanned}, migrated: ${migrated}, skipped: ${skipped}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
