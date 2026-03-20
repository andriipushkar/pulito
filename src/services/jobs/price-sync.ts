import { prisma } from '@/lib/prisma';
import path from 'path';
import fs from 'fs/promises';
import * as XLSX from 'xlsx';

const PRICE_FILE_DIR = path.join(process.cwd(), 'uploads', 'price-lists');

interface PriceEntry {
  code: string;
  name?: string;
  priceRetail?: number;
  priceWholesale?: number;
  priceWholesale2?: number;
  priceWholesale3?: number;
}

/**
 * Parse CSV price list in format:
 * Код,Назва,"Ціна, євро","Роздріб, грн",Опт1,Опт2,Опт3
 */
function parsePriceCsv(content: string): PriceEntry[] {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const entries: PriceEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Handle quoted CSV fields
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of lines[i]) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue; }
      current += char;
    }
    fields.push(current.trim());

    const code = fields[0];
    if (!code) continue; // Skip category headers (no code)

    const priceRetail = parseFloat(fields[3]);
    const opt1 = parseFloat(fields[4]);
    const opt2 = parseFloat(fields[5]);
    const opt3 = parseFloat(fields[6]);

    // Skip rows with no prices or zero prices
    if (isNaN(priceRetail) || priceRetail <= 0) continue;

    entries.push({
      code,
      name: fields[1] || undefined,
      priceRetail,
      priceWholesale: !isNaN(opt1) && opt1 > 0 ? opt1 : undefined,
      priceWholesale2: !isNaN(opt2) && opt2 > 0 ? opt2 : undefined,
      priceWholesale3: !isNaN(opt3) && opt3 > 0 ? opt3 : undefined,
    });
  }

  return entries;
}

/**
 * Parse XLSX/XLS price list. Expects same column structure as CSV:
 * Код | Назва | Ціна євро | Роздріб грн | Опт1 | Опт2 | Опт3
 */
function parsePriceXlsx(buffer: Buffer): PriceEntry[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const rows: unknown[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
  if (rows.length < 2) return [];

  const entries: PriceEntry[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const code = String(row[0] || '').trim();
    if (!code) continue;

    const priceRetail = parseFloat(String(row[3]));
    const opt1 = parseFloat(String(row[4]));
    const opt2 = parseFloat(String(row[5]));
    const opt3 = parseFloat(String(row[6]));

    if (isNaN(priceRetail) || priceRetail <= 0) continue;

    entries.push({
      code,
      name: String(row[1] || '').trim() || undefined,
      priceRetail,
      priceWholesale: !isNaN(opt1) && opt1 > 0 ? opt1 : undefined,
      priceWholesale2: !isNaN(opt2) && opt2 > 0 ? opt2 : undefined,
      priceWholesale3: !isNaN(opt3) && opt3 > 0 ? opt3 : undefined,
    });
  }

  return entries;
}

/**
 * Sync prices from the latest uploaded price list file (CSV, XLSX, or JSON).
 */
export async function syncPricesFromFile() {
  try {
    await fs.mkdir(PRICE_FILE_DIR, { recursive: true });
  } catch { /* exists */ }

  const files = await fs.readdir(PRICE_FILE_DIR);
  const priceFiles = files
    .filter((f) => f.endsWith('.csv') || f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.json'))
    .filter((f) => !f.startsWith('processed_'))
    .sort()
    .reverse();

  if (priceFiles.length === 0) {
    return { updated: 0, message: 'Файл з цінами не знайдено' };
  }

  const latestFile = path.join(PRICE_FILE_DIR, priceFiles[0]);
  const ext = path.extname(priceFiles[0]).toLowerCase();

  let entries: PriceEntry[];
  if (ext === '.csv') {
    const raw = await fs.readFile(latestFile, 'utf-8');
    entries = parsePriceCsv(raw);
  } else if (ext === '.xlsx' || ext === '.xls') {
    const buffer = await fs.readFile(latestFile);
    entries = parsePriceXlsx(buffer);
  } else {
    const raw = await fs.readFile(latestFile, 'utf-8');
    entries = JSON.parse(raw);
  }

  let updated = 0;
  let notFound = 0;
  let priceChanged = 0;
  let errors = 0;

  for (const entry of entries) {
    if (!entry.code) continue;

    try {
      const product = await prisma.product.findFirst({
        where: { code: entry.code },
        select: {
          id: true,
          priceRetail: true,
          priceWholesale: true,
          priceWholesale2: true,
          priceWholesale3: true,
        },
      });

      if (!product) {
        notFound++;
        continue;
      }

      const data: Record<string, unknown> = {};
      const oldRetail = Number(product.priceRetail);

      if (entry.priceRetail !== undefined) {
        if (oldRetail !== entry.priceRetail) {
          data.priceRetailOld = oldRetail;
          priceChanged++;
        }
        data.priceRetail = entry.priceRetail;
      }
      if (entry.priceWholesale !== undefined) {
        const oldW = Number(product.priceWholesale || 0);
        if (oldW !== entry.priceWholesale) data.priceWholesaleOld = oldW || null;
        data.priceWholesale = entry.priceWholesale;
      }
      if (entry.priceWholesale2 !== undefined) data.priceWholesale2 = entry.priceWholesale2;
      if (entry.priceWholesale3 !== undefined) data.priceWholesale3 = entry.priceWholesale3;

      if (Object.keys(data).length > 0) {
        await prisma.product.update({
          where: { id: product.id },
          data,
        });

        if (priceChanged > 0 || entry.priceWholesale !== undefined) {
          await prisma.priceHistory.create({
            data: {
              productId: product.id,
              priceRetailOld: String(oldRetail),
              priceRetailNew: entry.priceRetail ? String(entry.priceRetail) : null,
              priceWholesaleOld: product.priceWholesale ? String(product.priceWholesale) : null,
              priceWholesaleNew: entry.priceWholesale ? String(entry.priceWholesale) : null,
              priceWholesale2Old: product.priceWholesale2 ? String(product.priceWholesale2) : null,
              priceWholesale2New: entry.priceWholesale2 ? String(entry.priceWholesale2) : null,
              priceWholesale3Old: product.priceWholesale3 ? String(product.priceWholesale3) : null,
              priceWholesale3New: entry.priceWholesale3 ? String(entry.priceWholesale3) : null,
            },
          });
        }

        updated++;
      }
    } catch {
      // Skip this entry — don't break the entire batch
      errors++;
    }
  }

  // Archive processed file
  const archiveName = `processed_${Date.now()}_${priceFiles[0]}`;
  await fs.rename(latestFile, path.join(PRICE_FILE_DIR, archiveName));

  return { updated, notFound, priceChanged, errors, total: entries.length };
}

export { parsePriceCsv, parsePriceXlsx };
