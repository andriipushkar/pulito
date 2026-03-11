import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    theme: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/config/env', () => ({
  env: { UPLOAD_DIR: '/tmp/uploads' },
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn().mockReturnValue(true),
      mkdirSync: vi.fn(),
    },
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
  };
});

import { prisma } from '@/lib/prisma';
import type { MockPrismaClient } from '@/test/prisma-mock';

const mockPrisma = prisma as unknown as MockPrismaClient;

import {
  getActiveTheme,
  getAllThemes,
  activateTheme,
  updateThemeSettings,
  ThemeError,
  THEME_FRESHNESS,
  THEME_CRYSTAL,
  THEME_COZY,
} from './theme';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ThemeError', () => {
  it('should create a ThemeError with default status code', () => {
    const error = new ThemeError('theme not found');
    expect(error.message).toBe('theme not found');
    expect(error.name).toBe('ThemeError');
    expect(error.statusCode).toBe(400);
  });

  it('should create a ThemeError with custom status code', () => {
    const error = new ThemeError('not found', 404);
    expect(error.statusCode).toBe(404);
  });

  it('should be an instance of Error', () => {
    const error = new ThemeError('test');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('getActiveTheme', () => {
  it('should return default freshness theme when no active theme exists', async () => {
    mockPrisma.theme.findFirst.mockResolvedValue(null as never);

    const result = await getActiveTheme();

    expect(result).toEqual({
      id: 0,
      displayName: 'Свіжість та Органіка',
      cssVariables: THEME_FRESHNESS,
    });
    expect(mockPrisma.theme.findFirst).toHaveBeenCalledWith({
      where: { isActive: true },
    });
  });

  it('should return crystal theme when active theme has folderName "crystal"', async () => {
    mockPrisma.theme.findFirst.mockResolvedValue({
      id: 2,
      displayName: 'Кристальна чистота',
      folderName: 'crystal',
      customSettings: null,
      isActive: true,
    } as never);

    const result = await getActiveTheme();

    expect(result.id).toBe(2);
    expect(result.displayName).toBe('Кристальна чистота');
    expect(result.cssVariables).toEqual(THEME_CRYSTAL);
  });

  it('should return cozy theme when active theme has folderName "cozy"', async () => {
    mockPrisma.theme.findFirst.mockResolvedValue({
      id: 3,
      displayName: 'Домашній затишок',
      folderName: 'cozy',
      customSettings: null,
      isActive: true,
    } as never);

    const result = await getActiveTheme();

    expect(result.id).toBe(3);
    expect(result.cssVariables).toEqual(THEME_COZY);
  });

  it('should return freshness theme as base for unknown folderName', async () => {
    mockPrisma.theme.findFirst.mockResolvedValue({
      id: 1,
      displayName: 'Свіжість та Органіка',
      folderName: 'freshness',
      customSettings: null,
      isActive: true,
    } as never);

    const result = await getActiveTheme();

    expect(result.cssVariables).toEqual(THEME_FRESHNESS);
  });

  it('should merge customSettings over base theme variables', async () => {
    mockPrisma.theme.findFirst.mockResolvedValue({
      id: 2,
      displayName: 'Custom Crystal',
      folderName: 'crystal',
      customSettings: {
        '--color-primary': '#FF0000',
        '--color-bg': '#111111',
      },
      isActive: true,
    } as never);

    const result = await getActiveTheme();

    expect(result.cssVariables['--color-primary']).toBe('#FF0000');
    expect(result.cssVariables['--color-bg']).toBe('#111111');
    // Other variables should remain from THEME_CRYSTAL
    expect(result.cssVariables['--color-primary-light']).toBe(THEME_CRYSTAL['--color-primary-light']);
  });

  it('should handle empty customSettings object', async () => {
    mockPrisma.theme.findFirst.mockResolvedValue({
      id: 1,
      displayName: 'Plain Freshness',
      folderName: 'freshness',
      customSettings: {},
      isActive: true,
    } as never);

    const result = await getActiveTheme();

    expect(result.cssVariables).toEqual(THEME_FRESHNESS);
  });
});

describe('getAllThemes', () => {
  it('should return all themes ordered by installedAt desc', async () => {
    const themes = [
      { id: 2, displayName: 'Crystal', installedAt: new Date() },
      { id: 1, displayName: 'Freshness', installedAt: new Date() },
    ];
    mockPrisma.theme.findMany.mockResolvedValue(themes as never);

    const result = await getAllThemes();

    expect(result).toEqual(themes);
    expect(mockPrisma.theme.findMany).toHaveBeenCalledWith({
      orderBy: { installedAt: 'desc' },
    });
  });

  it('should return empty array when no themes exist', async () => {
    mockPrisma.theme.findMany.mockResolvedValue([] as never);

    const result = await getAllThemes();

    expect(result).toEqual([]);
  });
});

describe('activateTheme', () => {
  it('should deactivate all themes and activate the selected one', async () => {
    const theme = { id: 2, displayName: 'Crystal', isActive: false };
    const activatedTheme = { ...theme, isActive: true, activatedAt: expect.any(Date) };

    mockPrisma.theme.findUnique.mockResolvedValue(theme as never);
    mockPrisma.theme.updateMany.mockResolvedValue({ count: 1 } as never);
    mockPrisma.theme.update.mockResolvedValue(activatedTheme as never);
    // $transaction executes the callback with the prisma client itself
    mockPrisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(mockPrisma));

    const result = await activateTheme(2);

    expect(mockPrisma.theme.findUnique).toHaveBeenCalledWith({ where: { id: 2 } });
    expect(mockPrisma.theme.updateMany).toHaveBeenCalledWith({
      where: { isActive: true },
      data: { isActive: false },
    });
    expect(mockPrisma.theme.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { isActive: true, activatedAt: expect.any(Date) },
    });
    expect(result).toEqual(activatedTheme);
  });

  it('should throw ThemeError with 404 when theme not found', async () => {
    mockPrisma.theme.findUnique.mockResolvedValue(null as never);

    await expect(activateTheme(999)).rejects.toThrow(ThemeError);
    await expect(activateTheme(999)).rejects.toThrow('Тему не знайдено');

    try {
      await activateTheme(999);
    } catch (error) {
      expect((error as ThemeError).statusCode).toBe(404);
    }

    expect(mockPrisma.theme.updateMany).not.toHaveBeenCalled();
  });
});

describe('updateThemeSettings', () => {
  it('should update custom settings for an existing theme', async () => {
    const theme = { id: 1, displayName: 'Freshness', customSettings: {} };
    const customSettings = { '--color-primary': '#00FF00' };
    const updated = { ...theme, customSettings };

    mockPrisma.theme.findUnique.mockResolvedValue(theme as never);
    mockPrisma.theme.update.mockResolvedValue(updated as never);

    const result = await updateThemeSettings(1, customSettings);

    expect(mockPrisma.theme.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(mockPrisma.theme.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { customSettings },
    });
    expect(result).toEqual(updated);
  });

  it('should throw ThemeError with 404 when theme not found', async () => {
    mockPrisma.theme.findUnique.mockResolvedValue(null as never);

    await expect(updateThemeSettings(999, { '--color-primary': '#FF0000' })).rejects.toThrow(ThemeError);

    try {
      await updateThemeSettings(999, {});
    } catch (error) {
      expect((error as ThemeError).statusCode).toBe(404);
    }

    expect(mockPrisma.theme.update).not.toHaveBeenCalled();
  });
});

describe('uploadTheme', () => {
  it('should throw when theme.json is missing from ZIP', async () => {
    const { uploadTheme } = await import('./theme');
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip();
    zip.addFile('readme.txt', Buffer.from('hello'));
    const buffer = zip.toBuffer();

    await expect(uploadTheme(buffer, 'test.zip')).rejects.toThrow('ZIP-архів має містити файл theme.json');
  });

  it('should throw when theme.json has invalid JSON', async () => {
    const { uploadTheme } = await import('./theme');
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip();
    zip.addFile('theme.json', Buffer.from('not json'));
    const buffer = zip.toBuffer();

    await expect(uploadTheme(buffer, 'test.zip')).rejects.toThrow('Невалідний формат theme.json');
  });

  it('should throw when theme.json has no name field', async () => {
    const { uploadTheme } = await import('./theme');
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip();
    zip.addFile('theme.json', Buffer.from(JSON.stringify({ displayName: 'Test' })));
    const buffer = zip.toBuffer();

    await expect(uploadTheme(buffer, 'test.zip')).rejects.toThrow('theme.json має містити поле "name"');
  });

  it('should update existing theme when folderName matches', async () => {
    const { uploadTheme } = await import('./theme');
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip();
    zip.addFile('theme.json', Buffer.from(JSON.stringify({
      name: 'My Theme',
      displayName: 'My Display Name',
      variables: { '--color-primary': '#000' },
    })));
    const buffer = zip.toBuffer();

    mockPrisma.theme.findFirst.mockResolvedValue({ id: 5, folderName: 'my-theme' } as never);
    mockPrisma.theme.update.mockResolvedValue({ id: 5, displayName: 'My Display Name' } as never);

    const result = await uploadTheme(buffer, 'theme.zip');

    expect(result.id).toBe(5);
    expect(mockPrisma.theme.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: expect.objectContaining({ displayName: 'My Display Name' }),
      })
    );
  });

  it('should create new theme when no existing folderName', async () => {
    const { uploadTheme } = await import('./theme');
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip();
    zip.addFile('theme.json', Buffer.from(JSON.stringify({ name: 'NewTheme' })));
    const buffer = zip.toBuffer();

    const fs = await import('fs');
    vi.mocked(fs.existsSync).mockReturnValue(false);

    (mockPrisma.theme as Record<string, ReturnType<typeof vi.fn>>).create.mockResolvedValue({ id: 10, displayName: 'NewTheme' } as never);
    mockPrisma.theme.findFirst.mockResolvedValue(null as never);

    const result = await uploadTheme(buffer, 'theme.zip');

    expect(result.id).toBe(10);
    expect((mockPrisma.theme as Record<string, ReturnType<typeof vi.fn>>).create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          folderName: 'newtheme',
          isActive: false,
        }),
      })
    );
  });

  it('should use empty object when theme.json has no variables field (line 231)', async () => {
    const { uploadTheme } = await import('./theme');
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip();
    zip.addFile('theme.json', Buffer.from(JSON.stringify({
      name: 'NoVarsTheme',
      displayName: 'No Vars Display',
      // no variables field
    })));
    const buffer = zip.toBuffer();

    mockPrisma.theme.findFirst.mockResolvedValue({ id: 8, folderName: 'novarstheme' } as never);
    mockPrisma.theme.update.mockResolvedValue({ id: 8, displayName: 'No Vars Display' } as never);

    const result = await uploadTheme(buffer, 'novars.zip');

    expect(result.id).toBe(8);
    expect(mockPrisma.theme.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customSettings: {},
        }),
      })
    );
  });

  it('should use name as displayName when displayName not provided', async () => {
    const { uploadTheme } = await import('./theme');
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip();
    zip.addFile('theme.json', Buffer.from(JSON.stringify({ name: 'PlainName' })));
    const buffer = zip.toBuffer();

    mockPrisma.theme.findFirst.mockResolvedValue(null as never);
    (mockPrisma.theme as Record<string, ReturnType<typeof vi.fn>>).create.mockResolvedValue({ id: 11, displayName: 'PlainName' } as never);

    const result = await uploadTheme(buffer, 'theme.zip');

    expect(result.displayName).toBe('PlainName');
  });

  it('should handle theme.json in subdirectory', async () => {
    const { uploadTheme } = await import('./theme');
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip();
    zip.addFile('subdir/theme.json', Buffer.from(JSON.stringify({ name: 'SubTheme' })));
    const buffer = zip.toBuffer();

    mockPrisma.theme.findFirst.mockResolvedValue(null as never);
    (mockPrisma.theme as Record<string, ReturnType<typeof vi.fn>>).create.mockResolvedValue({ id: 12, displayName: 'SubTheme' } as never);

    const result = await uploadTheme(buffer, 'theme.zip');

    expect(result.id).toBe(12);
  });

  it('should throw on zip-slip path traversal', async () => {
    // Import path and temporarily override resolve behavior
    const path = await import('path');
    const fs = await import('fs');
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const { uploadTheme } = await import('./theme');
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip();
    zip.addFile('theme.json', Buffer.from(JSON.stringify({ name: 'Traversal' })));
    zip.addFile('styles.css', Buffer.from('body{}'));
    const buffer = zip.toBuffer();

    // Manually construct a zip with a path-traversal entry by modifying the zip's raw data
    // The zip Local File Header contains the filename at offset 30
    // Instead, we'll test by verifying the security check works with a known-bad path
    // by creating a zip where the entry name passes through resolve to a bad path

    // Use a simpler approach: the function under test uses path.resolve(themesDir, entry.entryName)
    // If entry.entryName starts with '/' it resolves to an absolute path outside themesDir
    // adm-zip allows absolute paths when adding files directly to entries array
    const maliciousZip = new AdmZip(buffer);
    const entries = maliciousZip.getEntries();
    // Hack: modify the entry header directly
    for (const entry of entries) {
      if (entry.entryName === 'styles.css') {
        (entry as unknown as { entryName: string }).entryName = '/etc/passwd';
        break;
      }
    }

    // Now call uploadTheme with the original buffer but override getEntries
    // Actually, since we can't easily modify the zip, let's mock adm-zip
    vi.doMock('adm-zip', () => {
      return {
        default: class MockAdmZip {
          constructor() {}
          getEntries() {
            return [
              { entryName: 'theme.json', getData: () => Buffer.from(JSON.stringify({ name: 'Evil' })) },
              { entryName: '../../etc/passwd' },
            ];
          }
          extractAllTo() {}
        },
      };
    });

    // Need fresh import to pick up the mock
    vi.resetModules();
    vi.mock('@/lib/prisma', () => ({
      prisma: {
        theme: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
          findUnique: vi.fn(),
          updateMany: vi.fn(),
          update: vi.fn(),
          create: vi.fn(),
        },
        $transaction: vi.fn(),
      },
    }));
    vi.mock('@/config/env', () => ({
      env: { UPLOAD_DIR: '/tmp/uploads' },
    }));
    vi.mock('fs', async (importOriginal) => {
      const actual = await importOriginal<typeof import('fs')>();
      return {
        ...actual,
        default: { ...actual, existsSync: vi.fn().mockReturnValue(true), mkdirSync: vi.fn() },
        existsSync: vi.fn().mockReturnValue(true),
        mkdirSync: vi.fn(),
      };
    });

    const freshMod = await import('./theme');

    await expect(freshMod.uploadTheme(Buffer.from('fake'), 'evil.zip')).rejects.toThrow(
      'ZIP-архів містить небезпечні шляхи'
    );
  });
});
