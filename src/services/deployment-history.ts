import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '@/lib/logger';

const execFileAsync = promisify(execFile);

/**
 * Read the last N commits from the local git checkout. Useful as a poor man's
 * deployment timeline — assumes prod runs the same checkout that was deployed.
 * Returns an empty list if git is unavailable.
 */

export interface DeploymentEntry {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  subject: string;
}

export async function getRecentDeployments(limit = 10): Promise<DeploymentEntry[]> {
  try {
    // unit separator (US, 0x1F) keeps fields together even if subjects contain pipes
    const sep = '\x1f';
    const recordSep = '\x1e';
    const format = ['%H', '%h', '%an', '%aI', '%s'].join(sep);
    const { stdout } = await execFileAsync('git', [
      'log',
      `-n`,
      String(limit),
      `--pretty=format:${format}${recordSep}`,
    ]);
    return stdout
      .split(recordSep)
      .map((line) => line.replace(/^\s+/, ''))
      .filter(Boolean)
      .map((line) => {
        const [hash, shortHash, author, date, subject] = line.split(sep);
        return { hash, shortHash, author, date, subject };
      });
  } catch (err) {
    logger.warn('[deployment-history] git log failed', { error: String(err) });
    return [];
  }
}
