import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);
const BACKUP_DIR = path.join(process.cwd(), 'backups');
const MAX_BACKUPS = 7; // Keep last 7 backups

/**
 * Create a PostgreSQL database backup using pg_dump.
 */
export async function createDatabaseBackup() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup_${timestamp}.sql.gz`;
  const filepath = path.join(BACKUP_DIR, filename);

  // Parse DB URL for pg_dump
  const url = new URL(dbUrl);
  const env = {
    ...process.env,
    PGPASSWORD: decodeURIComponent(url.password),
  };

  const pgDumpCmd = `pg_dump -h ${url.hostname} -p ${url.port || 5432} -U ${url.username} -d ${url.pathname.slice(1)} --no-owner --no-acl | gzip > "${filepath}"`;

  try {
    await execAsync(pgDumpCmd, { env, timeout: 300000 });
  } catch {
    // Try via docker if pg_dump is not available locally
    const containerName = process.env.DB_CONTAINER_NAME || 'clean_postgres';
    const dockerCmd = `docker exec ${containerName} pg_dump -U ${url.username} -d ${url.pathname.slice(1)} --no-owner --no-acl | gzip > "${filepath}"`;
    await execAsync(dockerCmd, { timeout: 300000 });
  }

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
