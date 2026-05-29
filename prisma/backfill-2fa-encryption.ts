/**
 * One-time backfill: encrypt existing plaintext `twoFactorSecret` values at rest
 * (TF5). Safe to re-run — already-encrypted rows are skipped (isEncrypted), and
 * every row is round-trip verified (decrypt(new) === original) BEFORE the write,
 * so a key mismatch aborts the row instead of corrupting a login secret.
 *
 * Run:  npx tsx prisma/backfill-2fa-encryption.ts            (apply)
 *       DRY_RUN=1 npx tsx prisma/backfill-2fa-encryption.ts  (count only)
 *
 * Uses the same .env APP_SECRET the app uses, so the app can decrypt the result.
 */
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma';
import { encrypt, decrypt, isEncrypted } from '../src/lib/encryption';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.env.DRY_RUN === '1';

async function main() {
  // Self-test: confirm the encryption key round-trips before touching any row.
  const probe = 'TOTP_PROBE_ABC123';
  if (decrypt(encrypt(probe)) !== probe) {
    throw new Error('Encryption round-trip self-test FAILED — aborting (check APP_SECRET).');
  }

  const users = await prisma.user.findMany({
    where: { twoFactorSecret: { not: null } },
    select: { id: true, twoFactorSecret: true },
  });

  let encrypted = 0;
  let already = 0;
  let failed = 0;

  for (const u of users) {
    const secret = u.twoFactorSecret!;
    if (isEncrypted(secret)) {
      already++;
      continue;
    }
    const ciphertext = encrypt(secret);
    // Verify BEFORE writing — never persist something we can't decrypt back.
    if (decrypt(ciphertext) !== secret) {
      console.error(`[backfill-2fa] round-trip FAILED for user ${u.id} — skipped`);
      failed++;
      continue;
    }
    if (!DRY_RUN) {
      await prisma.user.update({ where: { id: u.id }, data: { twoFactorSecret: ciphertext } });
    }
    encrypted++;
  }

  console.log(
    `[backfill-2fa] ${DRY_RUN ? '(DRY RUN) ' : ''}total=${users.length} ` +
      `encrypted=${encrypted} alreadyEncrypted=${already} failed=${failed}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
