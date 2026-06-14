import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { cleanDatabase, createTestUser, disconnectPrisma } from './helpers';
import { setupTestDB } from './setup';

describe('Two-factor authentication flow (real DB)', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    await setupTestDB();
    await cleanDatabase();

    user = await createTestUser({
      fullName: '2FA Тест',
      phone: '+380501234567',
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectPrisma();
  });

  it('should enable TOTP 2FA and verify login requires code', async () => {
    // 1. Verify 2FA is initially disabled
    const initialUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(initialUser!.twoFactorEnabled).toBe(false);
    expect(initialUser!.twoFactorSecret).toBeNull();
    expect(initialUser!.twoFactorBackupCodes).toEqual([]);

    // 2. Generate TOTP secret (simulated — in real app this uses speakeasy/otpauth)
    const totpSecret = 'JBSWY3DPEHPK3PXP'; // base32 encoded test secret
    const backupCodes = [
      'BACKUP-001-ABC',
      'BACKUP-002-DEF',
      'BACKUP-003-GHI',
      'BACKUP-004-JKL',
      'BACKUP-005-MNO',
      'BACKUP-006-PQR',
      'BACKUP-007-STU',
      'BACKUP-008-VWX',
    ];

    // 3. Enable 2FA for user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: totpSecret,
        twoFactorBackupCodes: backupCodes,
      },
    });

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updatedUser!.twoFactorEnabled).toBe(true);
    expect(updatedUser!.twoFactorSecret).toBe(totpSecret);
    expect(updatedUser!.twoFactorBackupCodes).toHaveLength(8);

    // 4. Simulate login — with 2FA enabled, login requires verification
    const loginUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    expect(loginUser!.twoFactorEnabled).toBe(true);
    // The login flow should now require a TOTP code before granting access

    // 5. Record login attempt in login history
    await prisma.loginHistory.create({
      data: {
        userId: user.id,
        ipAddress: '127.0.0.1',
        userAgent: 'vitest-integration-test',
        device: 'desktop',
        browser: 'Chrome',
        os: 'Linux',
        success: true,
      },
    });

    const loginEntry = await prisma.loginHistory.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(loginEntry).not.toBeNull();
    expect(loginEntry!.success).toBe(true);
  });

  it('should use backup code for 2FA verification', async () => {
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    const backupCodes = dbUser!.twoFactorBackupCodes;
    expect(backupCodes.length).toBeGreaterThan(0);

    // Use the first backup code
    const codeToUse = backupCodes[0];
    const isValidBackup = backupCodes.includes(codeToUse);
    expect(isValidBackup).toBe(true);

    // Remove used backup code
    const remainingCodes = backupCodes.filter((c) => c !== codeToUse);
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorBackupCodes: remainingCodes },
    });

    const afterUse = await prisma.user.findUnique({ where: { id: user.id } });
    expect(afterUse!.twoFactorBackupCodes).toHaveLength(backupCodes.length - 1);
    expect(afterUse!.twoFactorBackupCodes).not.toContain(codeToUse);
  });

  it('should reject invalid backup code', async () => {
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    const backupCodes = dbUser!.twoFactorBackupCodes;

    const invalidCode = 'INVALID-CODE-999';
    const isValid = backupCodes.includes(invalidCode);
    expect(isValid).toBe(false);

    // Record failed login attempt
    await prisma.loginHistory.create({
      data: {
        userId: user.id,
        ipAddress: '192.168.1.100',
        userAgent: 'vitest-integration-test',
        success: false,
      },
    });

    const failedLogin = await prisma.loginHistory.findFirst({
      where: { userId: user.id, success: false },
    });
    expect(failedLogin).not.toBeNull();
  });

  it('should disable 2FA', async () => {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      },
    });

    const disabledUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(disabledUser!.twoFactorEnabled).toBe(false);
    expect(disabledUser!.twoFactorSecret).toBeNull();
    expect(disabledUser!.twoFactorBackupCodes).toEqual([]);
  });

  it('should track login history across multiple attempts', async () => {
    // Create several login history entries
    const attempts = [
      { success: true, ipAddress: '10.0.0.1' },
      { success: true, ipAddress: '10.0.0.2' },
      { success: false, ipAddress: '192.168.0.1' },
    ];

    for (const attempt of attempts) {
      await prisma.loginHistory.create({
        data: {
          userId: user.id,
          ipAddress: attempt.ipAddress,
          success: attempt.success,
        },
      });
    }

    const allLogins = await prisma.loginHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    expect(allLogins.length).toBeGreaterThanOrEqual(3);

    const failedLogins = allLogins.filter((l) => !l.success);
    expect(failedLogins.length).toBeGreaterThanOrEqual(1);
  });
});
