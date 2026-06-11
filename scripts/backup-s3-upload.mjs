// Offsite DB-backup upload to S3-compatible storage (AWS S3 / Backblaze B2 /
// Cloudflare R2). Called by backup.sh after the local pg_dump succeeds.
//
// Uses @aws-sdk/client-s3 (already a project dependency) — no aws-cli/rclone
// needed. NO-OP (exit 0) until BACKUP_S3_BUCKET is set in the app .env, so it's
// safe to wire now and activate later by adding creds:
//   BACKUP_S3_BUCKET=...   AWS_ACCESS_KEY_ID=...   AWS_SECRET_ACCESS_KEY=...
//   AWS_REGION=...         (optional) AWS_S3_ENDPOINT=...  for B2/R2
//   (optional) BACKUP_S3_RETENTION_DAYS=30  — prune old bucket objects
//
// Usage: backup-s3-upload.mjs <file> [<file> ...]
// After a successful upload it prunes db-backups/ objects older than the
// retention window and writes backups/offsite-status.json for monitoring.
import { readFileSync, writeFileSync, createReadStream, statSync } from 'node:fs';
import { basename } from 'node:path';

const filePaths = process.argv.slice(2);
if (filePaths.length === 0) {
  console.error('usage: backup-s3-upload.mjs <file> [<file> ...]');
  process.exit(2);
}

const STATUS_FILE = '/home/pulitotrade/backups/offsite-status.json';

function writeStatus(ok, message, uploaded = []) {
  try {
    writeFileSync(
      STATUS_FILE,
      JSON.stringify({ ok, lastRun: new Date().toISOString(), message, uploaded }, null, 2),
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

const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = await import(
  '@aws-sdk/client-s3'
);
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

const uploaded = [];
try {
  for (const filePath of filePaths) {
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
    uploaded.push({ key, size });
  }
} catch (err) {
  writeStatus(false, `upload failed: ${err.message}`, uploaded);
  throw err;
}

// Prune old offsite objects — without this the bucket grows forever. Local
// retention (backup.sh, 14d) is intentionally shorter than offsite (30d).
const retentionDays = Number(env.BACKUP_S3_RETENTION_DAYS || 30);
const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
try {
  let token;
  const stale = [];
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: 'db-backups/', ContinuationToken: token }),
    );
    for (const obj of page.Contents || []) {
      if (obj.Key && obj.LastModified && obj.LastModified.getTime() < cutoff) {
        stale.push({ Key: obj.Key });
      }
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  // DeleteObjects caps at 1000 keys per call — far above a daily-backup reality.
  for (let i = 0; i < stale.length; i += 1000) {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: stale.slice(i, i + 1000) },
      }),
    );
  }
  if (stale.length > 0) {
    console.log(`[s3] pruned ${stale.length} objects older than ${retentionDays}d`);
  }
} catch (err) {
  // Prune failure must not fail the backup — the upload already succeeded.
  console.log(`[s3] WARN: retention prune failed: ${err.message}`);
}

writeStatus(true, `uploaded ${uploaded.length} file(s)`, uploaded);
