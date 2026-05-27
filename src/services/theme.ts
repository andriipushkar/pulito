import { prisma } from '@/lib/prisma';

export class ThemeError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'ThemeError';
  }
}

// Тема 1: «Синій океан» — blue primary (default).
// Primary darkened to #1565C0 to satisfy WCAG AA (4.5:1 contrast on white).
export const THEME_FRESHNESS: Record<string, string> = {
  '--color-primary': '#1565C0',
  '--color-primary-light': '#1E88E5',
  '--color-primary-dark': '#0D47A1',
  '--color-primary-50': '#E3F2FD',
  '--color-primary-100': '#BBDEFB',
  '--color-secondary': '#FFC107',
  '--color-accent': '#FF9800',
  '--color-danger': '#c62828',
  '--color-warning': '#c77700',
  '--color-success': '#2e7d32',
  '--color-info': '#1565C0',
  '--color-bg': '#ffffff',
  '--color-bg-secondary': '#F5F5F5',
  '--color-bg-overlay': 'rgba(0, 0, 0, 0.5)',
  '--color-text': '#212121',
  '--color-text-secondary': '#6B6B6B',
  '--color-border': '#E0E0E0',
  '--color-discount': '#c62828',
  '--color-in-stock': '#2e7d32',
  '--color-out-of-stock': '#9E9E9E',
  '--radius': '0.375rem',
  '--shadow': '0 1px 3px rgba(0, 0, 0, 0.08)',
  '--shadow-md': '0 2px 8px rgba(0, 0, 0, 0.1)',
  '--shadow-lg': '0 4px 16px rgba(0, 0, 0, 0.12)',
  '--shadow-xl': '0 8px 24px rgba(0, 0, 0, 0.15)',
  '--transition-base': '150ms cubic-bezier(0.4, 0, 0.2, 1)',
};

// Тема 2: «Кристальна чистота» — sky-blue primary, orange CTA
export const THEME_CRYSTAL: Record<string, string> = {
  '--color-primary': '#87CEEB',
  '--color-primary-light': '#A8DCEF',
  '--color-primary-dark': '#5DB8D9',
  '--color-primary-50': '#f0f9ff',
  '--color-primary-100': '#daf0fc',
  '--color-secondary': '#FF8C42',
  '--color-accent': '#FF8C42',
  '--color-danger': '#ef4444',
  '--color-warning': '#f59e0b',
  '--color-success': '#10b981',
  '--color-info': '#87CEEB',
  '--color-bg': '#ffffff',
  '--color-bg-secondary': '#f7fafd',
  '--color-bg-overlay': 'rgba(0, 0, 0, 0.5)',
  '--color-text': '#1e293b',
  '--color-text-secondary': '#64748b',
  '--color-border': '#e2e8f0',
  '--color-discount': '#ef4444',
  '--color-in-stock': '#10b981',
  '--color-out-of-stock': '#94a3b8',
  '--radius': '0.5rem',
  '--shadow': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  '--shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  '--shadow-xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '--transition-base': '150ms cubic-bezier(0.4, 0, 0.2, 1)',
};

// Тема 3: «Домашній затишок» — lavender primary, warm tones
export const THEME_COZY: Record<string, string> = {
  '--color-primary': '#B39DDB',
  '--color-primary-light': '#C9B8E8',
  '--color-primary-dark': '#9575CD',
  '--color-primary-50': '#f5f0ff',
  '--color-primary-100': '#ede4fc',
  '--color-secondary': '#F4A261',
  '--color-accent': '#F4A261',
  '--color-danger': '#ef4444',
  '--color-warning': '#f59e0b',
  '--color-success': '#10b981',
  '--color-info': '#B39DDB',
  '--color-bg': '#ffffff',
  '--color-bg-secondary': '#faf8fc',
  '--color-bg-overlay': 'rgba(0, 0, 0, 0.5)',
  '--color-text': '#1e293b',
  '--color-text-secondary': '#64748b',
  '--color-border': '#e8e0f0',
  '--color-discount': '#ef4444',
  '--color-in-stock': '#10b981',
  '--color-out-of-stock': '#94a3b8',
  '--radius': '0.5rem',
  '--shadow': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  '--shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  '--shadow-xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '--transition-base': '150ms cubic-bezier(0.4, 0, 0.2, 1)',
};

export async function getActiveTheme() {
  const theme = await prisma.theme.findFirst({
    where: { isActive: true },
  });

  if (!theme) {
    return {
      id: 0,
      displayName: 'Свіжість та Органіка',
      cssVariables: THEME_FRESHNESS,
    };
  }

  const customSettings = (theme.customSettings as Record<string, string>) || {};
  const baseTheme =
    theme.folderName === 'crystal'
      ? THEME_CRYSTAL
      : theme.folderName === 'cozy'
        ? THEME_COZY
        : THEME_FRESHNESS;
  const cssVariables = { ...baseTheme, ...customSettings };

  return {
    id: theme.id,
    displayName: theme.displayName,
    cssVariables,
  };
}

export async function getAllThemes() {
  return prisma.theme.findMany({
    orderBy: { installedAt: 'desc' },
  });
}

export async function activateTheme(themeId: number) {
  const theme = await prisma.theme.findUnique({ where: { id: themeId } });
  if (!theme) {
    throw new ThemeError('Тему не знайдено', 404);
  }

  // Atomically deactivate all and activate selected theme
  return prisma.$transaction(async (tx) => {
    await tx.theme.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    return tx.theme.update({
      where: { id: themeId },
      data: { isActive: true, activatedAt: new Date() },
    });
  });
}

// Reject CSS values that look like script/injection. We can't whitelist the
// universe of keys (themes define their own), but we can refuse values that
// contain js: protocols, <script>, or expression() — none of which belong
// in a CSS custom property.
const CSS_INJECTION_RE = /(<\s*script|javascript:|expression\s*\(|<\s*iframe|\bdata:text\/html)/i;

// Cap the customSettings JSON. A realistic theme exposes a few dozen vars;
// past 200 keys it's mis-use as a DB store and JSON parse cost rises.
const MAX_CUSTOM_SETTINGS_KEYS = 200;

export async function updateThemeSettings(themeId: number, customSettings: Record<string, string>) {
  const theme = await prisma.theme.findUnique({ where: { id: themeId } });
  if (!theme) {
    throw new ThemeError('Тему не знайдено', 404);
  }

  const entries = Object.entries(customSettings);
  if (entries.length > MAX_CUSTOM_SETTINGS_KEYS) {
    throw new ThemeError(
      `Забагато налаштувань (макс ${MAX_CUSTOM_SETTINGS_KEYS}, отримано ${entries.length})`,
      400,
    );
  }

  const cleaned: Record<string, string> = {};
  for (const [key, raw] of entries) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(key)) {
      throw new ThemeError(`Невалідне ім’я налаштування: ${key}`, 400);
    }
    const value = String(raw);
    if (value.length > 500) {
      throw new ThemeError(`Значення "${key}" занадто довге (макс 500)`, 400);
    }
    if (CSS_INJECTION_RE.test(value)) {
      throw new ThemeError(`Значення "${key}" містить заборонену конструкцію`, 400);
    }
    cleaned[key] = value;
  }

  // Return before-snapshot so the route can audit-log the diff.
  const before = (theme.customSettings as Record<string, string>) || {};
  const updated = await prisma.theme.update({
    where: { id: themeId },
    data: { customSettings: cleaned },
  });
  return { before, theme: updated };
}

/**
 * Завантажує та встановлює тему з ZIP-архіву.
 * Валідує наявність theme.json та директорії styles.
 * @param buffer - ZIP-файл як Buffer
 * @param filename - Оригінальне ім'я файлу
 * @returns Створений об'єкт теми
 */
// Decompressed-size cap on theme uploads. Anything larger than 100 MB is
// either a zip-bomb or accidentally includes the node_modules. Without this,
// a 10 MB compressed ZIP could expand to gigabytes and fill the disk.
const MAX_THEME_DECOMPRESSED_BYTES = 100 * 1024 * 1024;

export async function uploadTheme(buffer: Buffer, _filename: string) {
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  // Sum declared uncompressed sizes BEFORE extracting anything. AdmZip
  // exposes `header.size` without decompressing the entry.
  let declaredTotal = 0;
  for (const e of entries) {
    if (e.isDirectory) continue;
    declaredTotal += e.header.size;
    if (declaredTotal > MAX_THEME_DECOMPRESSED_BYTES) {
      throw new ThemeError('ZIP-архів задекларовано надто великим (zip-bomb захист)', 400);
    }
  }

  // Validate theme.json exists
  const themeJsonEntry = entries.find(
    (e) => e.entryName === 'theme.json' || e.entryName.endsWith('/theme.json'),
  );
  if (!themeJsonEntry) {
    throw new ThemeError('ZIP-архів має містити файл theme.json', 400);
  }

  // Parse theme.json
  let themeConfig: { name: string; displayName?: string; variables?: Record<string, string> };
  try {
    themeConfig = JSON.parse(themeJsonEntry.getData().toString('utf-8'));
  } catch {
    throw new ThemeError('Невалідний формат theme.json', 400);
  }

  if (!themeConfig.name || typeof themeConfig.name !== 'string') {
    throw new ThemeError('theme.json має містити поле "name"', 400);
  }

  const folderName = themeConfig.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const displayName = themeConfig.displayName || themeConfig.name;

  // Extract to themes directory
  const path = await import('path');
  const fs = await import('fs');
  const { env } = await import('@/config/env');
  const themesDir = path.join(env.UPLOAD_DIR, 'themes', folderName);

  if (!fs.existsSync(themesDir)) {
    fs.mkdirSync(themesDir, { recursive: true });
  }

  // Validate all ZIP entries to prevent zip-slip path traversal
  const resolvedThemesDir = path.resolve(themesDir);
  for (const entry of entries) {
    const entryPath = path.resolve(themesDir, entry.entryName);
    if (!entryPath.startsWith(resolvedThemesDir + path.sep) && entryPath !== resolvedThemesDir) {
      throw new ThemeError('ZIP-архів містить небезпечні шляхи', 400);
    }
  }
  zip.extractAllTo(themesDir, true);

  // Refuse to re-upload over a currently-active theme — files would swap
  // in-place while users browse the storefront. Operator must deactivate
  // first (a different theme becomes active) before re-installing.
  const existing = await prisma.theme.findFirst({ where: { folderName } });
  if (existing?.isActive) {
    throw new ThemeError('Не можна оновити активну тему — спочатку активуйте іншу.', 409);
  }
  if (existing) {
    return prisma.theme.update({
      where: { id: existing.id },
      data: {
        displayName,
        customSettings: themeConfig.variables || {},
        installedAt: new Date(),
      },
    });
  }

  return prisma.theme.create({
    data: {
      displayName,
      folderName,
      isActive: false,
      customSettings: themeConfig.variables || {},
      installedAt: new Date(),
    },
  });
}
