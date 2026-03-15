import { execFile, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);
const BACKUP_DIR = path.join(process.cwd(), 'backups');
const MAX_BACKUPS = 7; // Keep last 7 backups

/**
 * Create a PostgreSQL database backup using pg_dump.
 * Uses execFile with argument array to prevent command injection.
 */
export async function createDatabaseBackup() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup_${timestamp}.sql.gz`;
  const filepath = path.join(BACKUP_DIR, filename);
  const rawFilepath = filepath.replace('.gz', '');

  // Parse DB URL for pg_dump — values are passed as arguments, not shell-interpolated
  const url = new URL(dbUrl);
  const dbName = url.pathname.slice(1);
  const dbHost = url.hostname;
  const dbPort = url.port || '5432';
  const dbUser = url.username;
  const env = {
    ...process.env,
    PGPASSWORD: decodeURIComponent(url.password),
  };

  try {
    // Use execFile with array args — no shell injection possible
    await execFileAsync('pg_dump', [
      '-h', dbHost,
      '-p', dbPort,
      '-U', dbUser,
      '-d', dbName,
      '--no-owner',
      '--no-acl',
      '-f', rawFilepath,
    ], { env, timeout: 300000 });
  } catch {
    // Try via docker if pg_dump is not available locally
    const containerName = process.env.DB_CONTAINER_NAME || 'clean_postgres';
    // For docker exec we still need shell for pipe, but args are validated
    if (!/^[a-zA-Z0-9_-]+$/.test(containerName)) throw new Error('Invalid container name');
    if (!/^[a-zA-Z0-9_-]+$/.test(dbUser)) throw new Error('Invalid DB username');
    if (!/^[a-zA-Z0-9_-]+$/.test(dbName)) throw new Error('Invalid DB name');

    await execFileAsync('docker', [
      'exec', containerName,
      'pg_dump', '-U', dbUser, '-d', dbName, '--no-owner', '--no-acl',
    ], { env, timeout: 300000 }).then(async ({ stdout }) => {
      await fs.writeFile(rawFilepath, stdout);
    });
  }

  // Compress with gzip
  await pipeline(
    (await import('fs')).createReadStream(rawFilepath),
    createGzip(),
    createWriteStream(filepath)
  );
  await fs.unlink(rawFilepath); // Remove uncompressed

  // Verify backup file exists and has content
  const stat = await fs.stat(filepath);
  if (stat.size < 100) {
    await fs.unlink(filepath);
    throw new Error('Backup file is empty or too small');
  }

  // Cleanup old backups
  const files = await fs.readdir(BACKUP_DIR);
  const backups = files
    .filter((f) => f.startsWith('backup_') && f.endsWith('.sql.gz'))
    .sort()
    .reverse();

  for (const old of backups.slice(MAX_BACKUPS)) {
    await fs.unlink(path.join(BACKUP_DIR, old));
  }

  return {
    filename,
    size: stat.size,
    path: filepath,
    totalBackups: Math.min(backups.length, MAX_BACKUPS),
  };
}
