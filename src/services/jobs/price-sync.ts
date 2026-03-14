import { prisma } from '@/lib/prisma';
import path from 'path';
import fs from 'fs/promises';

const PRICE_FILE_DIR = path.join(process.cwd(), 'uploads', 'price-lists');

interface PriceEntry {
  code: string;
  priceRetail?: number;
  priceWholesale?: number;
  stock?: number;
}

/**
 * Sync prices from the latest uploaded price list file (JSON format).
 * File format: [{ code: "ABC123", priceRetail: 100, priceWholesale: 80, stock: 50 }, ...]
 */
export async function syncPricesFromFile() {
  try {
    await fs.mkdir(PRICE_FILE_DIR, { recursive: true });
  } catch { /* exists */ }

  const files = await fs.readdir(PRICE_FILE_DIR);
  const jsonFiles = files.filter((f) => f.endsWith('.json')).sort().reverse();

  if (jsonFiles.length === 0) {
    return { updated: 0, message: 'Файл з цінами не знайдено' };
  }

  const latestFile = path.join(PRICE_FILE_DIR, jsonFiles[0]);
  const raw = await fs.readFile(latestFile, 'utf-8');
  const entries: PriceEntry[] = JSON.parse(raw);

  let updated = 0;
  let notFound = 0;

  for (const entry of entries) {
    if (!entry.code) continue;

    const product = await prisma.product.findFirst({
      where: { code: entry.code },
      select: { id: true },
    });

    if (!product) {
      notFound++;
      continue;
    }

    const data: Record<string, unknown> = {};
    if (entry.priceRetail !== undefined) data.priceRetail = entry.priceRetail;
    if (entry.priceWholesale !== undefined) data.priceWholesale = entry.priceWholesale;
    if (entry.stock !== undefined) data.stock = entry.stock;

    if (Object.keys(data).length > 0) {
      await prisma.product.update({
        where: { id: product.id },
        data,
      });
      updated++;
    }
  }

  // Archive processed file
  const archiveName = `processed_${Date.now()}_${jsonFiles[0]}`;
  await fs.rename(latestFile, path.join(PRICE_FILE_DIR, archiveName));

  return { updated, notFound, total: entries.length };
}
