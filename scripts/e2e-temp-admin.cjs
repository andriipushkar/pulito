#!/usr/bin/env node
/**
 * Creates/deletes the throwaway admin used by the post-deploy admin smoke
 * (e2e/admin-smoke.spec.ts). The account lives only for the duration of one
 * smoke run: deploy.sh calls `create`, runs playwright, then calls `delete`.
 *
 *   node scripts/e2e-temp-admin.cjs create   # prints E2E_ADMIN_* env lines
 *   node scripts/e2e-temp-admin.cjs delete
 *
 * Random 24-char password per run; printed to stdout only (deploy.sh captures
 * it into a chmod-600 temp file and removes it afterwards).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const EMAIL = 'e2e-smoke@internal.local';

function databaseUrl() {
  const line = fs
    .readFileSync(path.join(ROOT, '.env'), 'utf8')
    .split('\n')
    .find((l) => l.trim().startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL not found in .env');
  return line.trim().slice('DATABASE_URL='.length).replace(/^"|"$/g, '');
}

async function main() {
  const action = process.argv[2];
  if (action !== 'create' && action !== 'delete') {
    console.error('Usage: node scripts/e2e-temp-admin.cjs <create|delete>');
    process.exit(1);
  }

  const { Client } = require(path.join(ROOT, 'node_modules', 'pg'));
  const client = new Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query('DELETE FROM users WHERE email = $1', [EMAIL]);
    if (action === 'create') {
      const bcrypt = require(path.join(ROOT, 'node_modules', 'bcryptjs'));
      const password = crypto.randomBytes(18).toString('base64url');
      const hash = await bcrypt.hash(password, 10);
      await client.query(
        `INSERT INTO users (email, full_name, password_hash, role, created_at, updated_at)
         VALUES ($1, 'E2E Smoke', $2, 'admin', NOW(), NOW())`,
        [EMAIL, hash],
      );
      process.stdout.write(`E2E_ADMIN_EMAIL=${EMAIL}\nE2E_ADMIN_PASSWORD=${password}\n`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('e2e-temp-admin failed:', err.message);
  process.exit(1);
});
