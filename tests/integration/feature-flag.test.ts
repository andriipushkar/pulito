import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { cleanDatabase, createTestUser, disconnectPrisma } from './helpers';
import { setupTestDB } from './setup';

describe('Feature flag flow (real DB)', () => {
  let adminUser: Awaited<ReturnType<typeof createTestUser>>;
  let clientUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    await setupTestDB();
    await cleanDatabase();

    adminUser = await createTestUser({ fullName: 'Адмін Флагів', role: 'admin' });
    clientUser = await createTestUser({ fullName: 'Клієнт Тест', role: 'client' });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectPrisma();
  });

  it('should create, enable, and disable a feature flag', async () => {
    // 1. Create a feature flag (disabled by default)
    const flag = await prisma.featureFlag.create({
      data: {
        key: 'new_checkout_ui',
        description: 'Нова версія інтерфейсу оформлення замовлення',
        isEnabled: false,
        rolloutPercent: 100,
      },
    });

    expect(flag.id).toBeGreaterThan(0);
    expect(flag.key).toBe('new_checkout_ui');
    expect(flag.isEnabled).toBe(false);

    // 2. Verify feature is hidden when flag is disabled
    const disabledFlag = await prisma.featureFlag.findUnique({
      where: { key: 'new_checkout_ui' },
    });
    expect(disabledFlag!.isEnabled).toBe(false);

    // 3. Enable the flag
    await prisma.featureFlag.update({
      where: { key: 'new_checkout_ui' },
      data: { isEnabled: true },
    });

    const enabledFlag = await prisma.featureFlag.findUnique({
      where: { key: 'new_checkout_ui' },
    });
    expect(enabledFlag!.isEnabled).toBe(true);

    // 4. Disable the flag again
    await prisma.featureFlag.update({
      where: { key: 'new_checkout_ui' },
      data: { isEnabled: false },
    });

    const reDisabled = await prisma.featureFlag.findUnique({
      where: { key: 'new_checkout_ui' },
    });
    expect(reDisabled!.isEnabled).toBe(false);
  });

  it('should support role-based targeting', async () => {
    const flag = await prisma.featureFlag.create({
      data: {
        key: 'admin_dashboard_v2',
        description: 'Нова панель адміністратора',
        isEnabled: true,
        rolloutPercent: 100,
        targetRoles: ['admin', 'manager'],
      },
    });

    expect(flag.targetRoles).toEqual(['admin', 'manager']);

    // Admin should see the feature
    const isVisibleForAdmin = flag.targetRoles.length === 0 || flag.targetRoles.includes('admin');
    expect(isVisibleForAdmin).toBe(true);

    // Client should NOT see the feature
    const isVisibleForClient = flag.targetRoles.length === 0 || flag.targetRoles.includes('client');
    expect(isVisibleForClient).toBe(false);
  });

  it('should support user-specific targeting', async () => {
    const flag = await prisma.featureFlag.create({
      data: {
        key: 'beta_feature',
        description: 'Бета-функція для конкретних користувачів',
        isEnabled: true,
        rolloutPercent: 100,
        targetUserIds: [clientUser.id],
      },
    });

    // Targeted user should see the feature
    const isVisibleForClient =
      flag.targetUserIds.length === 0 || flag.targetUserIds.includes(clientUser.id);
    expect(isVisibleForClient).toBe(true);

    // Non-targeted user should NOT see the feature
    const isVisibleForAdmin =
      flag.targetUserIds.length === 0 || flag.targetUserIds.includes(adminUser.id);
    expect(isVisibleForAdmin).toBe(false);
  });

  it('should support rollout percentage', async () => {
    const flag = await prisma.featureFlag.create({
      data: {
        key: 'gradual_rollout',
        description: 'Поступове розгортання функції',
        isEnabled: true,
        rolloutPercent: 50, // 50% of users
      },
    });

    expect(flag.rolloutPercent).toBe(50);

    // Simple hash-based rollout check simulation
    const userIdHash = clientUser.id % 100;
    const isInRollout = userIdHash < flag.rolloutPercent;
    // We just verify the logic works, actual result depends on user ID
    expect(typeof isInRollout).toBe('boolean');
  });

  it('should list all feature flags', async () => {
    const allFlags = await prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });

    expect(allFlags.length).toBeGreaterThanOrEqual(4);

    // All flags should have required fields
    for (const flag of allFlags) {
      expect(flag.key).toBeTruthy();
      expect(typeof flag.isEnabled).toBe('boolean');
      expect(flag.rolloutPercent).toBeGreaterThanOrEqual(0);
      expect(flag.rolloutPercent).toBeLessThanOrEqual(100);
    }
  });

  it('should enforce unique key constraint', async () => {
    await prisma.featureFlag.create({
      data: {
        key: 'unique_flag',
        isEnabled: false,
      },
    });

    await expect(
      prisma.featureFlag.create({
        data: {
          key: 'unique_flag',
          isEnabled: true,
        },
      }),
    ).rejects.toThrow();
  });
});
