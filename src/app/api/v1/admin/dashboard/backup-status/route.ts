import { withRole } from '@/middleware/auth';
import { successResponse, errorResponse } from '@/utils/api-response';
import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';

const BACKUP_DIR = process.env.BACKUP_DIR || '/home/pulitotrade/backups';

interface BackupStatus {
  hasBackup: boolean;
  latestAt: string | null;
  sizeBytes: number | null;
  ageHours: number | null;
  ageStatus: 'fresh' | 'stale' | 'missing';
  /** Result of the last `backup-verify.sh` run, when available. */
  verify: {
    ok: boolean;
    lastCheck: string;
    message: string;
  } | null;
}

export const GET = withRole('admin', 'manager')(async () => {
  try {
    let entries: { name: string; mtime: Date; size: number }[] = [];
    try {
      const files = await fs.readdir(BACKUP_DIR);
      const stats = await Promise.all(
        files
          .filter((f) => /^pulito_.*\.sql\.gz$/.test(f))
          .map(async (name) => {
            const stat = await fs.stat(path.join(BACKUP_DIR, name));
            return { name, mtime: stat.mtime, size: stat.size };
          }),
      );
      entries = stats;
    } catch {
      // Directory missing — return "missing" status, not an error.
      const empty: BackupStatus = {
        hasBackup: false,
        latestAt: null,
        sizeBytes: null,
        ageHours: null,
        ageStatus: 'missing',
        verify: null,
      };
      return successResponse(empty);
    }

    if (entries.length === 0) {
      const empty: BackupStatus = {
        hasBackup: false,
        latestAt: null,
        sizeBytes: null,
        ageHours: null,
        ageStatus: 'missing',
        verify: null,
      };
      return successResponse(empty);
    }

    entries.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    const latest = entries[0];
    const ageHours = (Date.now() - latest.mtime.getTime()) / (1000 * 60 * 60);
    // Daily backups run at 03:00. We treat anything ≥48h as stale (one
    // missed cron run is the explicit threshold).
    const ageStatus: BackupStatus['ageStatus'] = ageHours > 48 ? 'stale' : 'fresh';

    // Pull last verify-restore result if backup-verify.sh has ever run.
    let verify: BackupStatus['verify'] = null;
    try {
      const raw = await fs.readFile(path.join(BACKUP_DIR, 'verify-status.json'), 'utf8');
      verify = JSON.parse(raw) as BackupStatus['verify'];
    } catch {
      // Missing or unreadable — fine; widget shows "ще не перевіряли".
    }

    const result: BackupStatus = {
      hasBackup: true,
      latestAt: latest.mtime.toISOString(),
      sizeBytes: latest.size,
      ageHours,
      ageStatus,
      verify,
    };
    return successResponse(result);
  } catch (err) {
    logger.error('[admin/dashboard/backup-status] GET failed', { error: err });
    return errorResponse('Не вдалося отримати стан бекапу', 500);
  }
});
