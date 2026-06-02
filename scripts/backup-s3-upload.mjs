// Offsite DB-backup upload to S3-compatible storage (AWS S3 / Backblaze B2 /
// Cloudflare R2). Called by backup.sh after the local pg_dump succeeds.
//
// Uses @aws-sdk/client-s3 (already a project dependency) — no aws-cli/rclone
// needed. NO-OP (exit 0) until BACKUP_S3_BUCKET is set in the app .env, so it's
// safe to wire now and activate later by adding creds:
//   BACKUP_S3_BUCKET=...   AWS_ACCESS_KEY_ID=...   AWS_SECRET_ACCESS_KEY=...
//   AWS_REGION=...         (optional) AWS_S3_ENDPOINT=...  for B2/R2
import { readFileSync, createReadStream, statSync } from 'node:fs';
import { basename } from 'node:path';

const filePath = process.argv[2];
if (!filePath) {
  console.error('usage: backup-s3-upload.mjs <file>');
  process.exit(2);
}

// Cron shells don't inherit the app env, so read the .env file directly.
let envText = '';
try {
  envText = readFileSync('/home/pulitotrade/pulito/.env', 'utf8');
} catch {
  /* no .env — treated as unconfigured below */
}
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}

const bucket = env.BACKUP_S3_BUCKET;
if (!bucket) {
  console.log('[s3] BACKUP_S3_BUCKET not set — skipping offsite upload (local backup kept)');
  process.exit(0);
}

const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
const client = new S3Client({
  region: env.AWS_REGION || 'eu-central-1',
  ...(env.AWS_S3_ENDPOINT ? { endpoint: env.AWS_S3_ENDPOINT, forcePathStyle: true } : {}),
  ...(env.AWS_ACCESS_KEY_ID
    ? {
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY || '',
        },
      }
    : {}),
});

const size = statSync(filePath).size;
const key = `db-backups/${basename(filePath)}`;
await client.send(
  new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: createReadStream(filePath),
    ContentLength: size,
  }),
);
console.log(`[s3] uploaded ${key} (${size} bytes) to ${bucket}`);
