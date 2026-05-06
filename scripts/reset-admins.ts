/**
 * Reset all users and create new admin(s).
 *
 * Reads admin credentials from environment variables to avoid passwords
 * leaking into shell history or commit logs:
 *
 *   ADMINS="admin1@example.com:Pass1!|admin2@example.com:Pass2!" \
 *     npx tsx scripts/reset-admins.ts
 *
 * Each admin is "email:password" separated by "|". Names default to the
 * email's local part. Passwords are bcrypt-hashed (10 rounds).
 *
 * SAFETY:
 *   - Refuses to run if NODE_ENV=production (use a dedicated migration
 *     script for prod). Override with FORCE=1 if you really mean it.
 *   - Wraps everything in a transaction. Rolls back if anything fails.
 *   - Deletes ALL existing users — cascade-deletes their orders, carts,
 *     reviews, etc. This is destructive.
 */
import 'dotenv/config';
import { hash } from 'bcryptjs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface AdminSpec {
  email: string;
  password: string;
  fullName: string;
}

function parseAdmins(raw: string): AdminSpec[] {
  return raw
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const idx = entry.indexOf(':');
      if (idx === -1) {
        throw new Error(`Invalid ADMINS entry "${entry}" — expected "email:password"`);
      }
      const email = entry.slice(0, idx).trim();
      const password = entry.slice(idx + 1).trim();
      const fullName = email.split('@')[0];
      return { email, password, fullName };
    });
}

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.FORCE !== '1') {
    throw new Error(
      'NODE_ENV=production refuses to run this destructive script. ' +
        'Set FORCE=1 to override (only do this if you understand the consequences).',
    );
  }

  const adminsRaw = process.env.ADMINS;
  if (!adminsRaw) {
    throw new Error('Set ADMINS env var, e.g. ADMINS="a@x.com:Pass1!|b@x.com:Pass2!"');
  }

  const admins = parseAdmins(adminsRaw);
  if (admins.length === 0) {
    throw new Error('Parsed 0 admins from ADMINS env var');
  }

  console.log(`[reset-admins] Will delete all users and create ${admins.length} admin(s):`);
  for (const a of admins) {
    console.log(`  - ${a.email} (name: ${a.fullName})`);
  }

  const before = await prisma.user.count();
  console.log(
    `[reset-admins] Deleting ${before} existing user(s) and dependent rows via TRUNCATE CASCADE…`,
  );

  // Some FKs from non-business tables (import_log.manager_id, etc.) don't
  // have ON DELETE CASCADE in the schema, so plain user.deleteMany() fails.
  // TRUNCATE CASCADE wipes all referencing rows transitively in one shot.
  // This is intentionally destructive — orders, carts, reviews, audit logs,
  // imports, etc. all go away together with users.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE users RESTART IDENTITY CASCADE');

  for (const admin of admins) {
    const passwordHash = await hash(admin.password, 10);
    await prisma.user.create({
      data: {
        email: admin.email,
        passwordHash,
        fullName: admin.fullName,
        role: 'admin',
        isVerified: true,
        isBlocked: false,
        wholesaleStatus: 'none',
      },
    });
    console.log(`  ✓ created admin ${admin.email}`);
  }

  const after = await prisma.user.count();
  console.log(`[reset-admins] Done. Users: ${before} → ${after}`);
}

main()
  .then(() => {
    console.log('[reset-admins] OK');
    return prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error('[reset-admins] FAILED:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
