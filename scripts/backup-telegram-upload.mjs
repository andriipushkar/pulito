// Offsite DB-backup delivery via the shop's Telegram bot. Called by backup.sh
// after the local pg_dump succeeds, alongside the S3 uploader.
//
// Active fallback: NO-OP (exit 0) when BACKUP_S3_BUCKET is configured — S3 is
// then the primary offsite and double-shipping ~15MB a day to Telegram is
// pointless. Until then this is the only copy that survives VPS disk loss.
//
// Credentials are resolved the same way the app does (site_settings key
// channel_telegram, AES-256-GCM values under APP_SECRET, env fallback). Files
// are GPG-symmetric-encrypted with BACKUP_PASSPHRASE before leaving the box —
// a full dump holds customer data and must not sit in Telegram cloud in the
// clear. Restore: gpg -d file.sql.gz.gpg | gunzip | psql ...
//
// Usage: backup-telegram-upload.mjs <file> [<file> ...]
import { readFileSync, writeFileSync, statSync, unlinkSync } from 'node:fs';
import { basename } from 'node:path';
import { createDecipheriv, scryptSync } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const filePaths = process.argv.slice(2);
if (filePaths.length === 0) {
  console.error('usage: backup-telegram-upload.mjs <file> [<file> ...]');
  process.exit(2);
}

const STATUS_FILE = '/home/pulitotrade/backups/telegram-status.json';
// Bot API caps uploads at 50MB; refuse a bit under to leave multipart headroom.
const MAX_BYTES = 49 * 1024 * 1024;

function writeStatus(ok, message, sent = []) {
  try {
    writeFileSync(
      STATUS_FILE,
      JSON.stringify({ ok, lastRun: new Date().toISOString(), message, sent }, null, 2),
    );
  } catch {
    /* status file is best-effort */
  }
}

// Cron shells don't inherit the app env, so read the .env file directly.
let envText = '';
try {
  envText = readFileSync('/home/pulitotrade/pulito/.env', 'utf8');
} catch {
  /* no .env — handled by the guards below */
}
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}

if (env.BACKUP_S3_BUCKET) {
  console.log('[tg] BACKUP_S3_BUCKET is set — S3 is primary offsite, skipping Telegram');
  process.exit(0);
}

const passphrase = env.BACKUP_PASSPHRASE;
if (!passphrase) {
  console.log('[tg] BACKUP_PASSPHRASE not set — refusing to ship unencrypted dumps, skipping');
  writeStatus(false, 'BACKUP_PASSPHRASE not set');
  process.exit(0);
}

// Mirror src/lib/encryption.ts decrypt() for values stored by the admin panel.
const KEY = scryptSync(env.APP_SECRET || 'dev-secret', 'salt', 32);
const ENCRYPTED_RE = /^[a-f0-9]{32}:[a-f0-9]{32}:[a-f0-9]+$/;
function decryptValue(data) {
  if (typeof data !== 'string' || !ENCRYPTED_RE.test(data)) return data;
  const [ivHex, tagHex, encryptedHex] = data.split(':');
  const decipher = createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

// DB-first creds (matches getTelegramCreds in src/services/channel-config.ts),
// env fallback per-field.
let cfg = {};
try {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    const res = await client.query(
      "SELECT value FROM site_settings WHERE key = 'channel_telegram'",
    );
    if (res.rows[0]?.value) cfg = JSON.parse(res.rows[0].value);
  } finally {
    await client.end();
  }
} catch (err) {
  console.log(`[tg] WARN: DB creds lookup failed (${err.message}), trying env fallback`);
}

const botToken = decryptValue(cfg.botToken) || env.TELEGRAM_BOT_TOKEN || '';
// Manager chat only — never channelId: the channel may be public marketing.
const chatId = decryptValue(cfg.managerChatId) || env.TELEGRAM_MANAGER_CHAT_ID || '';
if (!botToken || !chatId) {
  writeStatus(false, 'no botToken/managerChatId configured');
  console.error('[tg] no botToken or managerChatId — cannot deliver offsite backup');
  process.exit(1);
}

const sent = [];
let failed = false;
for (const filePath of filePaths) {
  const encPath = `${filePath}.gpg`;
  try {
    execFileSync('gpg', [
      '--batch', '--yes', '--symmetric', '--cipher-algo', 'AES256',
      '--passphrase', passphrase, '--output', encPath, filePath,
    ]);
    const size = statSync(encPath).size;
    if (size > MAX_BYTES) {
      console.error(`[tg] ${basename(encPath)} is ${size} bytes (> bot 50MB cap) — switch to S3`);
      failed = true;
      continue;
    }
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', `#backup ${basename(filePath)} (${(size / 1024 / 1024).toFixed(1)}MB, GPG)`);
    form.append('document', new Blob([readFileSync(encPath)]), basename(encPath));
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: 'POST',
      body: form,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) {
      console.error(`[tg] sendDocument failed for ${basename(encPath)}: ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
      failed = true;
      continue;
    }
    console.log(`[tg] delivered ${basename(encPath)} (${size} bytes)`);
    sent.push({ file: basename(encPath), size });
  } finally {
    // The .gpg copy is transient — the plain local backup stays per backup.sh
    // retention; keeping both would double disk use for nothing.
    try { unlinkSync(encPath); } catch { /* never created */ }
  }
}

writeStatus(!failed, failed ? 'one or more deliveries failed' : `sent ${sent.length} file(s)`, sent);
process.exit(failed ? 1 : 0);
