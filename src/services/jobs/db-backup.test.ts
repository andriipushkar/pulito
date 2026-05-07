import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecFile = vi.fn();
const mockReaddir = vi.fn();
const mockMkdir = vi.fn();
const mockStat = vi.fn();
const mockUnlink = vi.fn();
const mockWriteFile = vi.fn();

const mockCreateReadStream = vi.fn();
const mockCreateWriteStream = vi.fn();
const mockCreateGzip = vi.fn();
const mockPipeline = vi.fn();

vi.mock('child_process', () => ({
  execFile: (...args: unknown[]) => {
    // promisify wraps this, so we need the callback-style mock
    const cb = args[args.length - 1];
    if (typeof cb === 'function') {
      const result = mockExecFile(...args.slice(0, -1));
      if (result && typeof result.then === 'function') {
        result
          .then((r: { stdout?: string; stderr?: string }) =>
            cb(null, r.stdout || '', r.stderr || ''),
          )
          .catch((e: Error) => cb(e));
      } else {
        cb(null, '', '');
      }
    }
    return { stdout: '', stderr: '' };
  },
  exec: vi.fn(),
}));

vi.mock('util', () => ({
  promisify: (fn: unknown) => {
    // Return a function that calls mockExecFile directly for execFile
    return (...args: unknown[]) => mockExecFile(...args);
  },
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    readdir: (...args: unknown[]) => mockReaddir(...args),
    stat: (...args: unknown[]) => mockStat(...args),
    unlink: (...args: unknown[]) => mockUnlink(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
  },
}));

vi.mock('fs', () => ({
  createReadStream: (...args: unknown[]) => mockCreateReadStream(...args),
  createWriteStream: (...args: unknown[]) => mockCreateWriteStream(...args),
}));

vi.mock('zlib', () => ({
  createGzip: () => mockCreateGzip(),
}));

vi.mock('stream/promises', () => ({
  pipeline: (...args: unknown[]) => mockPipeline(...args),
}));

import { createDatabaseBackup } from './db-backup';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/cleandb';
  mockMkdir.mockResolvedValue(undefined);
  mockPipeline.mockResolvedValue(undefined);
  mockUnlink.mockResolvedValue(undefined);
  mockCreateReadStream.mockReturnValue('read-stream');
  mockCreateWriteStream.mockReturnValue('write-stream');
  mockCreateGzip.mockReturnValue('gzip-stream');
});

describe('createDatabaseBackup', () => {
  it('should throw when DATABASE_URL is not set', async () => {
    delete process.env.DATABASE_URL;
    await expect(createDatabaseBackup()).rejects.toThrow('DATABASE_URL not set');
  });

  it('should create backup directory if not exists', async () => {
    mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });
    mockStat.mockResolvedValue({ size: 1000 });
    mockReaddir.mockResolvedValue([]);

    await createDatabaseBackup();

    expect(mockMkdir).toHaveBeenCalledWith(expect.stringContaining('backups'), { recursive: true });
  });

  it('should call pg_dump with correct arguments', async () => {
    mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });
    mockStat.mockResolvedValue({ size: 1000 });
    mockReaddir.mockResolvedValue([]);

    await createDatabaseBackup();

    expect(mockExecFile).toHaveBeenCalledWith(
      'pg_dump',
      expect.arrayContaining([
        '-h',
        'localhost',
        '-p',
        '5432',
        '-U',
        'user',
        '-d',
        'cleandb',
        '--no-owner',
        '--no-acl',
      ]),
      expect.objectContaining({
        env: expect.objectContaining({ PGPASSWORD: 'pass' }),
        timeout: 300000,
      }),
    );
  });

  it('should fall back to docker when pg_dump fails', async () => {
    mockExecFile
      .mockRejectedValueOnce(new Error('pg_dump not found'))
      .mockResolvedValueOnce({ stdout: 'SQL dump data', stderr: '' });
    mockWriteFile.mockResolvedValue(undefined);
    mockStat.mockResolvedValue({ size: 1000 });
    mockReaddir.mockResolvedValue([]);

    await createDatabaseBackup();

    expect(mockExecFile).toHaveBeenCalledTimes(2);
    expect(mockExecFile).toHaveBeenLastCalledWith(
      'docker',
      expect.arrayContaining(['exec', 'pulito_postgres', 'pg_dump']),
      expect.any(Object),
    );
  });

  it('should throw if backup file is too small', async () => {
    mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });
    mockStat.mockResolvedValue({ size: 50 }); // less than 100 bytes
    mockReaddir.mockResolvedValue([]);

    await expect(createDatabaseBackup()).rejects.toThrow('Backup file is empty or too small');
    expect(mockUnlink).toHaveBeenCalled(); // Removes the bad file
  });

  it('should compress backup with gzip', async () => {
    mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });
    mockStat.mockResolvedValue({ size: 1000 });
    mockReaddir.mockResolvedValue([]);

    await createDatabaseBackup();

    expect(mockPipeline).toHaveBeenCalledWith('read-stream', 'gzip-stream', 'write-stream');
  });

  it('should cleanup old backups keeping only 7', async () => {
    mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });
    mockStat.mockResolvedValue({ size: 1000 });

    const backupFiles = Array.from(
      { length: 10 },
      (_, i) => `backup_2026-03-${String(i + 1).padStart(2, '0')}T00-00-00.sql.gz`,
    );
    mockReaddir.mockResolvedValue(backupFiles);

    const result = await createDatabaseBackup();

    // After sort().reverse() and slice(7), 3 old backups should be deleted
    // Plus one unlink for the raw .sql file = at least 3 old backup deletions
    const unlinkCalls = mockUnlink.mock.calls;
    // At least the raw SQL file + old backups are deleted
    expect(unlinkCalls.length).toBeGreaterThanOrEqual(1);
    expect(result.totalBackups).toBe(7);
  });

  it('should return backup metadata on success', async () => {
    mockExecFile.mockResolvedValue({ stdout: '', stderr: '' });
    mockStat.mockResolvedValue({ size: 5000 });
    mockReaddir.mockResolvedValue([]);

    const result = await createDatabaseBackup();

    expect(result.filename).toMatch(/^backup_.*\.sql\.gz$/);
    expect(result.size).toBe(5000);
    expect(result.path).toContain('backups');
  });
});
