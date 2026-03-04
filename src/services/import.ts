import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { createSlug } from '@/utils/slug';
import { cacheInvalidate } from '@/services/cache';

export class ImportError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'ImportError';
  }
}

interface ExcelRow {
  [key: string]: unknown;
}

interface ImportRowError {
  row: number;
  field: string;
  message: string;
  value?: unknown;
}

export interface ImportResult {
  importLogId: number;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  imagesImported: number;
  imagesFailed: number;
  errors: ImportRowError[];
  durationMs: number;
}

const IMAGE_DOWNLOAD_TIMEOUT = 10_000; // 10 seconds
const IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Block internal/private network URLs to prevent SSRF */
function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname;
    // Block localhost, private IPs, link-local, metadata endpoints
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function downloadAndProcessImage(url: string, productId: number): Promise<boolean> {
  try {
    if (!isAllowedUrl(url)) return false;

    const { processProductImage } = await import('./image');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMAGE_DOWNLOAD_TIMEOUT);

    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'error', // prevent redirect-based SSRF bypasses
      headers: { 'User-Agent': 'Poroshok-Import/1.0' },
    });
    clearTimeout(timeout);

    if (!res.ok) return false;

    const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() || '';
    if (!ALLOWED_IMAGE_TYPES.includes(contentType)) return false;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > IMAGE_MAX_SIZE || buffer.length === 0) return false;

    const filename = url.split('/').pop()?.split('?')[0] || 'imported.jpg';
    await processProductImage(buffer, contentType, filename, productId, true);
    return true;
  } catch {
    return false;
  }
}

// Column name mapping (Ukrainian → internal key)
const COLUMN_MAP: Record<string, string> = {
  'код продукції': 'code',
  'код': 'code',
  'code': 'code',
  'артикул': 'code',
  'назва': 'name',
  'найменування': 'name',
  'name': 'name',
  'категорія': 'category',
  'category': 'category',
  'кількість': 'quantity',
  'залишок': 'quantity',
  'quantity': 'quantity',
  'ціна роздріб': 'priceRetail',
  'роздрібна ціна': 'priceRetail',
  'ціна роздрібна': 'priceRetail',
  'price_retail': 'priceRetail',
  'ціна, грн': 'priceRetail',
  'ціна грн': 'priceRetail',
  'грн': 'priceRetail',
  'ціна опт': 'priceWholesale',
  'оптова ціна': 'priceWholesale',
  'ціна оптова': 'priceWholesale',
  'price_wholesale': 'priceWholesale',
  'ціна, євро': 'priceWholesale',
  'ціна євро': 'priceWholesale',
  'євро': 'priceWholesale',
  'акція': 'isPromo',
  'promo': 'isPromo',
  'is_promo': 'isPromo',
  'зображення': 'imageUrl',
  'фото': 'imageUrl',
  'image url': 'imageUrl',
  'imageurl': 'imageUrl',
  'image': 'imageUrl',
  'фото url': 'imageUrl',
  'посилання на фото': 'imageUrl',
};

function normalizeColumnName(name: string): string | null {
  const lower = name.trim().toLowerCase();
  return COLUMN_MAP[lower] ?? null;
}

function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).replace(',', '.').replace(/\s/g, '');
  const num = parseFloat(str);
  if (isNaN(num) || num < 0) return null;
  return Math.round(num * 100) / 100;
}

function parseQuantity(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const num = parseInt(String(value), 10);
  if (isNaN(num) || num < 0) return 0;
  return num;
}

function parsePromo(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const str = String(value).trim().toLowerCase();
  return ['так', 'yes', 'true', '1', 'да'].includes(str);
}

export type ImportFormat = 'standard' | 'supplier';

interface ParseResult {
  rows: Record<string, unknown>[];
  columnMapping: Record<string, string>;
  format: ImportFormat;
}

function generateAutoCode(name: string): string {
  const slug = createSlug(name);
  return slug.substring(0, 50);
}

function parseWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new ImportError('Файл не містить даних', 400);
  }
  const sheet = workbook.Sheets[sheetName];
  const rawRows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rawRows.length === 0) {
    throw new ImportError('Файл порожній', 400);
  }
  if (rawRows.length > 10000) {
    throw new ImportError('Максимальна кількість рядків: 10 000', 400);
  }

  return { rawRows, sheet };
}

function buildColumnMapping(rawRows: ExcelRow[]): { columnMapping: Record<string, string>; mappedKeys: string[] } {
  const headers = Object.keys(rawRows[0]);
  const columnMapping: Record<string, string> = {};

  for (const header of headers) {
    const mapped = normalizeColumnName(header);
    if (mapped) {
      columnMapping[header] = mapped;
    }
  }

  return { columnMapping, mappedKeys: Object.values(columnMapping) };
}

function parseRows(buffer: Buffer): ParseResult {
  const { rawRows } = parseWorkbook(buffer);
  const { columnMapping, mappedKeys } = buildColumnMapping(rawRows);

  const hasCode = mappedKeys.includes('code');
  const hasName = mappedKeys.includes('name');
  const hasPrice = mappedKeys.includes('priceRetail') || mappedKeys.includes('priceWholesale');

  // Supplier format: no code column, has name and at least one price column
  if (!hasCode && hasName && hasPrice) {
    return parseSupplierFormat(rawRows, columnMapping);
  }

  // Standard format: validate required columns
  if (!hasCode) {
    throw new ImportError('Не знайдено колонку "Код продукції"', 400);
  }
  if (!hasName) {
    throw new ImportError('Не знайдено колонку "Назва"', 400);
  }
  if (!mappedKeys.includes('priceRetail')) {
    throw new ImportError('Не знайдено колонку "Ціна роздріб"', 400);
  }

  // Normalize rows for standard format
  const rows = rawRows.map((raw) => {
    const normalized: Record<string, unknown> = {};
    for (const [header, key] of Object.entries(columnMapping)) {
      normalized[key] = raw[header];
    }
    return normalized;
  });

  return { rows, columnMapping, format: 'standard' };
}

function parseSupplierFormat(
  rawRows: ExcelRow[],
  columnMapping: Record<string, string>
): ParseResult {
  const rows: Record<string, unknown>[] = [];
  let currentCategory = '';

  for (const raw of rawRows) {
    const normalized: Record<string, unknown> = {};
    for (const [header, key] of Object.entries(columnMapping)) {
      normalized[key] = raw[header];
    }

    const name = String(normalized.name ?? '').trim();
    if (!name) continue;

    // Check if any price column has a value
    const retailPrice = parsePrice(normalized.priceRetail);
    const wholesalePrice = parsePrice(normalized.priceWholesale);
    const hasAnyPrice = retailPrice !== null || wholesalePrice !== null;

    if (!hasAnyPrice) {
      // Row without prices = category separator
      currentCategory = name;
      continue;
    }

    // Product row: generate code from name and assign current category
    normalized.code = generateAutoCode(name);
    if (currentCategory && !normalized.category) {
      normalized.category = currentCategory;
    }

    rows.push(normalized);
  }

  return { rows, columnMapping, format: 'supplier' };
}

/**
 * Parse Excel file and return raw preview data (headers + first rows).
 */
export function parsePreview(buffer: Buffer): {
  headers: string[];
  rows: string[][];
  totalRows: number;
  format: ImportFormat;
} {
  const { rawRows } = parseWorkbook(buffer);
  const { mappedKeys } = buildColumnMapping(rawRows);

  const hasCode = mappedKeys.includes('code');
  const hasName = mappedKeys.includes('name');
  const hasPrice = mappedKeys.includes('priceRetail') || mappedKeys.includes('priceWholesale');
  const format: ImportFormat = (!hasCode && hasName && hasPrice) ? 'supplier' : 'standard';

  const headers = Object.keys(rawRows[0]);
  const rows = rawRows.slice(0, 10).map((raw) =>
    headers.map((h) => String(raw[h] ?? ''))
  );

  return { headers, rows, totalRows: rawRows.length, format };
}

/**
 * @description Імпортує товари з Excel-буфера: створює/оновлює товари, автостворює категорії, завантажує зображення.
 * @param fileBuffer - Буфер Excel-файлу
 * @param filename - Ім'я файлу
 * @param managerId - Ідентифікатор менеджера, що виконує імпорт
 * @returns Результат імпорту (кількість створених, оновлених, пропущених, помилки)
 */
export async function importProducts(
  fileBuffer: Buffer,
  filename: string,
  managerId: number
): Promise<ImportResult> {
  const startTime = Date.now();

  // Create import log
  const importLog = await prisma.importLog.create({
    data: {
      managerId,
      filename,
      fileSizeBytes: fileBuffer.length,
      status: 'processing_import',
      startedAt: new Date(),
    },
  });

  const errors: ImportRowError[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let imagesImported = 0;
  let imagesFailed = 0;

  try {
    const { rows, format } = parseRows(fileBuffer);
    const isSupplierFormat = format === 'supplier';

    // Cache existing categories
    const existingCategories = await prisma.category.findMany({
      select: { id: true, name: true },
    });
    const categoryMap = new Map(existingCategories.map((c) => [c.name.toLowerCase(), c.id]));

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // Excel row number (1-indexed + header)
      const row = rows[i];

      try {
        // Validate code
        const code = String(row.code ?? '').trim();
        if (!code) {
          errors.push({ row: rowNum, field: 'code', message: 'Код продукції обов\'язковий' });
          skipped++;
          continue;
        }
        if (code.length > 50) {
          errors.push({ row: rowNum, field: 'code', message: 'Код продукції занадто довгий (макс. 50)', value: code });
          skipped++;
          continue;
        }

        // Validate name
        const name = String(row.name ?? '').trim();
        if (!name) {
          errors.push({ row: rowNum, field: 'name', message: 'Назва товару обов\'язкова' });
          skipped++;
          continue;
        }

        // Validate prices — in supplier format, at least one price is enough
        const priceRetail = parsePrice(row.priceRetail);
        const priceWholesale = parsePrice(row.priceWholesale);

        if (isSupplierFormat) {
          if (priceRetail === null && priceWholesale === null) {
            errors.push({ row: rowNum, field: 'price', message: 'Немає жодної ціни', value: row.priceRetail });
            skipped++;
            continue;
          }
        } else {
          if (priceRetail === null) {
            errors.push({ row: rowNum, field: 'priceRetail', message: 'Невірна роздрібна ціна', value: row.priceRetail });
            skipped++;
            continue;
          }
        }

        // Optional fields
        const quantity = parseQuantity(row.quantity);
        const isPromo = parsePromo(row.isPromo);

        // Handle category
        let categoryId: number | null = null;
        const categoryName = String(row.category ?? '').trim();
        if (categoryName) {
          const existingCatId = categoryMap.get(categoryName.toLowerCase());
          if (existingCatId) {
            categoryId = existingCatId;
          } else {
            // Auto-create category
            const slug = createSlug(categoryName);
            let finalSlug = slug;
            const slugExists = await prisma.category.findUnique({ where: { slug } });
            if (slugExists) {
              finalSlug = `${slug}-${Date.now()}`;
            }
            const newCategory = await prisma.category.create({
              data: { name: categoryName, slug: finalSlug },
            });
            categoryId = newCategory.id;
            categoryMap.set(categoryName.toLowerCase(), newCategory.id);
          }
        }

        // Check if product exists — in supplier format, also try matching by name
        let existingProduct = await prisma.product.findUnique({ where: { code } });
        if (!existingProduct && isSupplierFormat) {
          existingProduct = await prisma.product.findFirst({
            where: { name: { equals: name, mode: 'insensitive' } },
          });
        }

        if (existingProduct) {
          // Update existing product
          const updateData: Record<string, unknown> = {
            name,
            quantity,
            isPromo,
            isActive: true,
          };

          if (categoryId !== null) {
            updateData.categoryId = categoryId;
          }

          // Track price changes
          if (priceRetail !== null) {
            if (Number(existingProduct.priceRetail) !== priceRetail) {
              updateData.priceRetailOld = existingProduct.priceRetail;
              updateData.priceRetail = priceRetail;

              await prisma.priceHistory.create({
                data: {
                  productId: existingProduct.id,
                  priceRetailOld: existingProduct.priceRetail,
                  priceRetailNew: priceRetail,
                  priceWholesaleOld: existingProduct.priceWholesale,
                  priceWholesaleNew: priceWholesale ?? existingProduct.priceWholesale,
                  importId: importLog.id,
                },
              });
            } else {
              updateData.priceRetail = priceRetail;
            }
          }

          if (priceWholesale !== null) {
            if (Number(existingProduct.priceWholesale) !== priceWholesale) {
              updateData.priceWholesaleOld = existingProduct.priceWholesale;
            }
            updateData.priceWholesale = priceWholesale;
          }

          // Update slug if name changed
          if (existingProduct.name !== name) {
            const slug = createSlug(name);
            const slugExists = await prisma.product.findFirst({
              where: { slug, id: { not: existingProduct.id } },
            });
            updateData.slug = slugExists ? `${slug}-${code.toLowerCase()}` : slug;
          }

          await prisma.product.update({
            where: { id: existingProduct.id },
            data: updateData,
          });

          // Download image if URL provided
          const imageUrl = String(row.imageUrl ?? '').trim();
          if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
            const success = await downloadAndProcessImage(imageUrl, existingProduct.id);
            if (success) imagesImported++;
            else imagesFailed++;
          }

          updated++;
        } else {
          // Create new product
          const slug = createSlug(name);
          let finalSlug = slug;
          const slugExists = await prisma.product.findUnique({ where: { slug } });
          if (slugExists) {
            finalSlug = `${slug}-${code.toLowerCase()}`;
          }

          const newProduct = await prisma.product.create({
            data: {
              code,
              name,
              slug: finalSlug,
              categoryId,
              priceRetail: priceRetail ?? 0,
              priceWholesale,
              quantity,
              isPromo,
            },
          });

          // Download image if URL provided
          const imageUrl = String(row.imageUrl ?? '').trim();
          if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
            const success = await downloadAndProcessImage(imageUrl, newProduct.id);
            if (success) imagesImported++;
            else imagesFailed++;
          }

          created++;
        }
      } catch (rowError) {
        errors.push({
          row: rowNum,
          field: 'unknown',
          message: rowError instanceof Error ? rowError.message : 'Невідома помилка',
        });
        skipped++;
      }
    }

    const durationMs = Date.now() - startTime;

    // Update import log
    await prisma.importLog.update({
      where: { id: importLog.id },
      data: {
        status: 'completed_import',
        totalRows: rows.length,
        createdCount: created,
        updatedCount: updated,
        skippedCount: skipped,
        errorCount: errors.length,
        errorsJson: errors.length > 0 ? JSON.parse(JSON.stringify(errors)) : undefined,
        completedAt: new Date(),
        durationMs,
      },
    });

    // Invalidate product & category cache after import
    await cacheInvalidate('products:*');
    await cacheInvalidate('categories:*');

    return {
      importLogId: importLog.id,
      totalRows: rows.length,
      created,
      updated,
      skipped,
      imagesImported,
      imagesFailed,
      errors,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    await prisma.importLog.update({
      where: { id: importLog.id },
      data: {
        status: 'failed_import',
        errorCount: 1,
        errorsJson: [{ row: 0, field: 'file', message: error instanceof Error ? error.message : 'Помилка імпорту' }],
        completedAt: new Date(),
        durationMs,
      },
    });

    if (error instanceof ImportError) throw error;
    throw new ImportError('Помилка при обробці файлу', 500);
  }
}

/**
 * @description Отримує історію логів імпорту з пагінацією.
 * @param page - Номер сторінки (за замовчуванням 1)
 * @param limit - Кількість записів на сторінку (за замовчуванням 20)
 * @returns Об'єкт зі списком логів та загальною кількістю
 */
export async function getImportLogs(page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.importLog.findMany({
      orderBy: { id: 'desc' },
      skip,
      take: limit,
      include: {
        manager: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.importLog.count(),
  ]);

  return { logs, total };
}

/**
 * @description Отримує один лог імпорту за його ID.
 * @param id - Ідентифікатор логу імпорту
 * @returns Лог імпорту з даними менеджера або null
 */
export async function getImportLogById(id: number) {
  return prisma.importLog.findUnique({
    where: { id },
    include: {
      manager: { select: { id: true, fullName: true, email: true } },
    },
  });
}
