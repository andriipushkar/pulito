import ExcelJS from 'exceljs';
import { XMLParser } from 'fast-xml-parser';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { createSlug } from '@/utils/slug';
import { cacheInvalidate } from '@/services/cache';

export class ImportError extends Error {
  constructor(
    message: string,
    public statusCode: number,
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
  variantsCreated?: number;
  variantsUpdated?: number;
  errors: ImportRowError[];
  durationMs: number;
}

const IMAGE_DOWNLOAD_TIMEOUT = 10_000; // 10 seconds
const IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Check IPv4 octets against private/loopback/link-local/CGNAT/multicast ranges */
function isPrivateIPv4(octets: number[]): boolean {
  if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
    return false;
  }
  const [a, b] = octets;
  // 0.0.0.0/8 — current network
  if (a === 0) return true;
  // 10.0.0.0/8 — private
  if (a === 10) return true;
  // 100.64.0.0/10 — CGNAT
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 — loopback
  if (a === 127) return true;
  // 169.254.0.0/16 — link-local
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 — private (172.16 - 172.31)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 — private
  if (a === 192 && b === 168) return true;
  // 224.0.0.0/4 — multicast
  if (a >= 224 && a <= 239) return true;
  return false;
}

function parseIPv4(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((p) => Number(p));
  return octets.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? octets : null;
}

/** Block internal/private network URLs to prevent SSRF (IPv4 + IPv6) */
function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    let hostname = parsed.hostname.toLowerCase();
    // IPv6 hostnames are wrapped in [] by the URL parser; strip for matching.
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      hostname = hostname.slice(1, -1);
    }

    if (
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return false;
    }

    const ipv4 = parseIPv4(hostname);
    if (ipv4) return !isPrivateIPv4(ipv4);

    // IPv6 checks
    if (hostname.includes(':')) {
      // Loopback ::1, unspecified ::
      if (hostname === '::1' || hostname === '::') return false;
      // Link-local fe80::/10  (fe80 - febf)
      if (/^fe[89ab][0-9a-f]?:/.test(hostname)) return false;
      // Unique local fc00::/7  (fc00 - fdff)
      if (/^f[cd][0-9a-f]{2}:/.test(hostname)) return false;
      // IPv4-mapped ::ffff:a.b.c.d — verify embedded IPv4
      const mapped = hostname.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
      if (mapped) {
        const inner = parseIPv4(mapped[1]);
        if (inner && isPrivateIPv4(inner)) return false;
      }
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
      headers: { 'User-Agent': 'PulitoTrade-Import/1.0' },
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
  код: 'code',
  code: 'code',
  артикул: 'code',
  назва: 'name',
  найменування: 'name',
  name: 'name',
  категорія: 'category',
  category: 'category',
  кількість: 'quantity',
  залишок: 'quantity',
  quantity: 'quantity',
  'ціна роздріб': 'priceRetail',
  'роздрібна ціна': 'priceRetail',
  'ціна роздрібна': 'priceRetail',
  price_retail: 'priceRetail',
  'ціна, грн': 'priceRetail',
  'ціна грн': 'priceRetail',
  грн: 'priceRetail',
  'ціна опт': 'priceWholesale',
  'гуртова ціна': 'priceWholesale',
  'ціна гуртова': 'priceWholesale',
  price_wholesale: 'priceWholesale',
  'ціна, євро': 'priceWholesale',
  'ціна євро': 'priceWholesale',
  євро: 'priceWholesale',
  'ціна опт 2': 'priceWholesale2',
  'гуртова ціна 2': 'priceWholesale2',
  price_wholesale_2: 'priceWholesale2',
  'опт група 2': 'priceWholesale2',
  'ціна опт 3': 'priceWholesale3',
  'гуртова ціна 3': 'priceWholesale3',
  price_wholesale_3: 'priceWholesale3',
  'опт група 3': 'priceWholesale3',
  акція: 'isPromo',
  promo: 'isPromo',
  is_promo: 'isPromo',
  штрихкод: 'barcode',
  'штрих-код': 'barcode',
  штрихкоди: 'barcode',
  barcode: 'barcode',
  ean: 'barcode',
  'ean-13': 'barcode',
  upc: 'barcode',
  gtin: 'barcode',
  зображення: 'imageUrl',
  фото: 'imageUrl',
  'image url': 'imageUrl',
  imageurl: 'imageUrl',
  image: 'imageUrl',
  'фото url': 'imageUrl',
  'посилання на фото': 'imageUrl',
  // Content / SEO columns (for full round-trip export→import)
  'короткий опис': 'shortDescription',
  short_description: 'shortDescription',
  'short description': 'shortDescription',
  опис: 'description',
  description: 'description',
  характеристики: 'specifications',
  specifications: 'specifications',
  'seo заголовок': 'seoTitle',
  seo_title: 'seoTitle',
  'seo title': 'seoTitle',
  'seo опис': 'seoDescription',
  seo_description: 'seoDescription',
  'seo description': 'seoDescription',
  'seo ключові слова': 'seoKeywords',
  seo_keywords: 'seoKeywords',
  'seo keywords': 'seoKeywords',
  // Variants — rows with variant_sku attach to the parent product (matched by `code`)
  // instead of creating a new product. Useful for size/color/flavour fan-outs
  // where you want one storefront card but multiple SKUs in stock.
  variant_sku: 'variantSku',
  'variant sku': 'variantSku',
  'sku варіанта': 'variantSku',
  'артикул варіанта': 'variantSku',
  variant_name: 'variantName',
  'назва варіанта': 'variantName',
  variant_size: 'variantSize',
  розмір: 'variantSize',
  size: 'variantSize',
  variant_color: 'variantColor',
  колір: 'variantColor',
  color: 'variantColor',
  variant_flavour: 'variantFlavour',
  смак: 'variantFlavour',
  flavour: 'variantFlavour',
  variant_barcode: 'variantBarcode',
  'штрихкод варіанта': 'variantBarcode',
  variant_weight_grams: 'variantWeightGrams',
  variant_weight: 'variantWeightGrams',
  'вага варіанта': 'variantWeightGrams',
  variant_cost: 'variantCost',
  'собівартість варіанта': 'variantCost',
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

function buildContentData(row: Record<string, unknown>): Record<string, string> | null {
  const fields: Record<string, string> = {};
  const shortDesc = String(row.shortDescription ?? '').trim();
  const desc = String(row.description ?? '').trim();
  const specs = String(row.specifications ?? '').trim();
  const seoTitle = String(row.seoTitle ?? '').trim();
  const seoDesc = String(row.seoDescription ?? '').trim();
  const seoKeys = String(row.seoKeywords ?? '').trim();

  if (shortDesc) fields.shortDescription = shortDesc;
  if (desc) fields.description = desc;
  if (specs) fields.specifications = specs;
  if (seoTitle) fields.seoTitle = seoTitle;
  if (seoDesc) fields.seoDescription = seoDesc;
  if (seoKeys) fields.seoKeywords = seoKeys;

  return Object.keys(fields).length > 0 ? fields : null;
}

export type ImportFormat = 'standard' | 'supplier';

interface ParseResult {
  rows: Record<string, unknown>[];
  columnMapping: Record<string, string>;
  format: ImportFormat;
}

const PRICE_ONLY_KEYS = new Set([
  'code',
  'name',
  'priceRetail',
  'priceWholesale',
  'priceWholesale2',
  'priceWholesale3',
]);

function generateAutoCode(name: string): string {
  const slug = createSlug(name);
  return slug.substring(0, 50);
}

// ExcelJS cell values can be strings, numbers, dates, formula objects, or
// rich-text objects. Normalise to a plain string/number/null suitable for the
// downstream parsers (parsePrice, etc.) which were originally written against
// xlsx's sheet_to_json output.
function normalizeCellValue(v: unknown): unknown {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    // Formula result
    if ('result' in (v as Record<string, unknown>)) {
      return normalizeCellValue((v as { result: unknown }).result);
    }
    // Rich text
    if ('richText' in (v as Record<string, unknown>)) {
      const parts = (v as { richText: { text: string }[] }).richText;
      return parts.map((p) => p.text).join('');
    }
    // Hyperlink object
    if ('text' in (v as Record<string, unknown>)) {
      return String((v as { text: unknown }).text ?? '');
    }
    if (v instanceof Date) return v;
  }
  return v;
}

/**
 * Detect whether the buffer is an XML feed (YML / CommerceML) by sniffing
 * the first non-whitespace bytes. Anything that starts with `<` is treated
 * as XML; ExcelJS handles the rest.
 */
function isXmlBuffer(buffer: Buffer): boolean {
  const head = buffer.slice(0, 200).toString('utf8').trimStart();
  return head.startsWith('<?xml') || head.startsWith('<yml_catalog') || head.startsWith('<КоммерческаяИнформация');
}

/**
 * Parse Yandex Market YML feed (XML-based, widely used by Ukrainian B2B
 * suppliers). Maps `<offer>` elements onto the same rawRows shape ExcelJS
 * produces, so the rest of the import pipeline doesn't care about the source
 * format. Handles `<param name="size">M</param>` by mapping known names to
 * variant_* columns.
 */
async function parseYmlBuffer(buffer: Buffer): Promise<{ rawRows: ExcelRow[] }> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    parseAttributeValue: false,
    isArray: (name) => ['offer', 'category', 'param', 'picture'].includes(name),
  });

  let doc: unknown;
  try {
    doc = parser.parse(buffer.toString('utf8'));
  } catch (err) {
    throw new ImportError(
      `Невалідний XML: ${err instanceof Error ? err.message : 'parse error'}`,
      400,
    );
  }

  type YmlParam = { '@_name'?: string; '@_unit'?: string; '#text'?: string | number };
  type YmlOffer = {
    '@_id'?: string;
    '@_available'?: string;
    name?: string;
    'name#text'?: string;
    vendor?: string;
    vendorCode?: string;
    barcode?: string;
    price?: string | number;
    oldprice?: string | number;
    purchase_price?: string | number;
    quantity_in_stock?: string | number;
    stock_quantity?: string | number;
    categoryId?: string | number;
    picture?: string[] | string;
    description?: string;
    param?: YmlParam[];
  };
  type YmlCategory = { '@_id'?: string; '#text'?: string };

  const root = (doc as { yml_catalog?: { shop?: unknown } }).yml_catalog;
  if (!root) {
    throw new ImportError('Підтримується тільки формат Yandex Market (yml_catalog)', 400);
  }
  const shop = root.shop as { categories?: { category?: YmlCategory[] }; offers?: { offer?: YmlOffer[] } } | undefined;
  if (!shop) throw new ImportError('YML без секції shop', 400);

  // categoryId → categoryName
  const categoryById = new Map<string, string>();
  for (const cat of shop.categories?.category ?? []) {
    const id = String(cat['@_id'] ?? '');
    const text = String(cat['#text'] ?? '').trim();
    if (id && text) categoryById.set(id, text);
  }

  const offers = shop.offers?.offer ?? [];
  if (offers.length === 0) throw new ImportError('YML не містить жодного offer', 400);
  if (offers.length > 10000) throw new ImportError('Максимальна кількість offer: 10 000', 400);

  const rawRows: ExcelRow[] = [];
  for (const offer of offers) {
    const id = String(offer['@_id'] ?? '').trim();
    if (!id) continue; // every YML offer needs an id

    const params = new Map<string, string>();
    const paramUnits = new Map<string, string>();
    for (const p of offer.param ?? []) {
      const name = String(p['@_name'] ?? '').trim().toLowerCase();
      const value = String(p['#text'] ?? '').trim();
      const unit = String(p['@_unit'] ?? '').trim().toLowerCase();
      if (name && value) {
        params.set(name, value);
        if (unit) paramUnits.set(name, unit);
      }
    }

    const categoryName = offer.categoryId ? categoryById.get(String(offer.categoryId)) ?? '' : '';
    const pictures = offer.picture;
    const firstImage = Array.isArray(pictures) ? pictures[0] : pictures ?? '';

    // Headers must match what COLUMN_MAP normalises — using canonical Ukrainian
    // names so YML feeds and Excel uploads share one mapping path.
    const row: ExcelRow = {
      'Код продукції': offer.vendorCode || id,
      'Назва': String(offer.name ?? '').trim(),
      'Категорія': categoryName,
      'Ціна роздріб': offer.price ?? null,
      'Кількість':
        offer.quantity_in_stock ??
        offer.stock_quantity ??
        (String(offer['@_available'] ?? '').toLowerCase() === 'true' ? 1 : 0),
      'Штрихкод': offer.barcode ?? '',
      'Фото': firstImage,
      'Опис': offer.description ?? '',
    };

    // Forward known params onto variant columns (size, color, flavour, weight).
    if (params.has('розмір') || params.has('size')) {
      row['Розмір'] = params.get('розмір') ?? params.get('size') ?? '';
    }
    if (params.has('колір') || params.has('color')) {
      row['Колір'] = params.get('колір') ?? params.get('color') ?? '';
    }
    // YML weight — prefer explicit `unit` attribute over heuristic. Supported
    // units: g, gr, грам, грамм | kg, кг, kilogram. Without `unit`, fall back
    // to the <50→kg / ≥50→g heuristic.
    const weightRaw = params.get('вага') ?? params.get('weight') ?? '';
    const weightUnit = paramUnits.get('вага') ?? paramUnits.get('weight') ?? '';
    if (weightRaw) {
      const num = parseFloat(weightRaw.replace(',', '.'));
      if (Number.isFinite(num) && num > 0) {
        let grams: number;
        const unit = weightUnit.toLowerCase();
        if (['g', 'gr', 'грам', 'грамм', 'гр'].includes(unit)) {
          grams = Math.round(num);
        } else if (['kg', 'кг', 'kilogram', 'kilograms'].includes(unit)) {
          grams = Math.round(num * 1000);
        } else {
          // Heuristic fallback.
          grams = num < 50 ? Math.round(num * 1000) : Math.round(num);
        }
        row['variant_weight_grams'] = grams;
      }
    }

    rawRows.push(row);
  }

  return { rawRows };
}

async function parseWorkbook(buffer: Buffer) {
  // Route XML/YML feeds to a different parser; the rest of the pipeline
  // consumes the same ExcelRow shape, so callers don't change.
  if (isXmlBuffer(buffer)) {
    return parseYmlBuffer(buffer);
  }

  const workbook = new ExcelJS.Workbook();
  // ExcelJS types still reference the old Buffer signature without
  // ArrayBufferLike; cast through ArrayBuffer to keep the runtime contract.
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new ImportError('Файл не містить даних', 400);
  }

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = String(normalizeCellValue(cell.value) ?? '').trim();
  });

  const rawRows: ExcelRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // skip header row
    const obj: ExcelRow = {};
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i];
      if (!key) continue;
      obj[key] = normalizeCellValue(row.getCell(i + 1).value);
    }
    rawRows.push(obj);
  });

  if (rawRows.length === 0) {
    throw new ImportError('Файл порожній', 400);
  }
  if (rawRows.length > 10000) {
    throw new ImportError('Максимальна кількість рядків: 10 000', 400);
  }

  return { rawRows };
}

function buildColumnMapping(rawRows: ExcelRow[]): {
  columnMapping: Record<string, string>;
  mappedKeys: string[];
} {
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

async function parseRows(buffer: Buffer): Promise<ParseResult> {
  const { rawRows } = await parseWorkbook(buffer);
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

/**
 * Parse rows for explicit price-only import mode. Does not require `name`,
 * does not auto-create products. Validates that at least `code` + one price
 * column are mapped.
 */
async function parsePriceRows(buffer: Buffer): Promise<Record<string, unknown>[]> {
  const { rawRows } = await parseWorkbook(buffer);
  const { columnMapping, mappedKeys } = buildColumnMapping(rawRows);

  if (!mappedKeys.includes('code')) {
    throw new ImportError('Не знайдено колонку "Код продукції"', 400);
  }
  if (
    !mappedKeys.includes('priceRetail') &&
    !mappedKeys.includes('priceWholesale') &&
    !mappedKeys.includes('priceWholesale2') &&
    !mappedKeys.includes('priceWholesale3')
  ) {
    throw new ImportError('Не знайдено колонку з ціною', 400);
  }

  // Only honour code + price columns; ignore everything else even if mapped
  const allowedKeys = new Set(PRICE_ONLY_KEYS);
  return rawRows.map((raw) => {
    const normalized: Record<string, unknown> = {};
    for (const [header, key] of Object.entries(columnMapping)) {
      if (allowedKeys.has(key)) normalized[key] = raw[header];
    }
    return normalized;
  });
}

function parseSupplierFormat(
  rawRows: ExcelRow[],
  columnMapping: Record<string, string>,
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
    const wholesalePrice2 = parsePrice(normalized.priceWholesale2);
    const wholesalePrice3 = parsePrice(normalized.priceWholesale3);
    const hasAnyPrice =
      retailPrice !== null ||
      wholesalePrice !== null ||
      wholesalePrice2 !== null ||
      wholesalePrice3 !== null;

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

export interface PriceDiffRow {
  code: string;
  name: string | null;
  oldRetail: number | null;
  newRetail: number | null;
  oldWholesale: number | null;
  newWholesale: number | null;
  oldWholesale2: number | null;
  newWholesale2: number | null;
  oldWholesale3: number | null;
  newWholesale3: number | null;
  status: 'changed' | 'unchanged' | 'missing';
}

export interface PreviewResult {
  headers: string[];
  rows: string[][];
  totalRows: number;
  format: ImportFormat;
}

export interface PricePreviewResult {
  headers: string[];
  totalRows: number;
  changedCount: number;
  unchangedCount: number;
  missingCount: number;
  sample: PriceDiffRow[];
}

/**
 * Parse Excel file and return raw preview data (headers + first rows).
 */
export async function parsePreview(buffer: Buffer): Promise<PreviewResult> {
  const { rawRows } = await parseWorkbook(buffer);
  const { mappedKeys } = buildColumnMapping(rawRows);

  const hasCode = mappedKeys.includes('code');
  const hasName = mappedKeys.includes('name');
  const hasPrice = mappedKeys.includes('priceRetail') || mappedKeys.includes('priceWholesale');
  const format: ImportFormat = !hasCode && hasName && hasPrice ? 'supplier' : 'standard';

  const headers = Object.keys(rawRows[0]);
  const rows = rawRows.slice(0, 10).map((raw) => headers.map((h) => String(raw[h] ?? '')));

  return { headers, rows, totalRows: rawRows.length, format };
}

/**
 * Preview for explicit price-only update: returns a diff of new vs current
 * prices, plus summary counters. Does not require a `name` column.
 */
export async function parsePricePreview(buffer: Buffer): Promise<PricePreviewResult> {
  const { rawRows } = await parseWorkbook(buffer);
  const { columnMapping, mappedKeys } = buildColumnMapping(rawRows);

  if (!mappedKeys.includes('code')) {
    throw new ImportError('Не знайдено колонку "Код продукції"', 400);
  }
  if (
    !mappedKeys.includes('priceRetail') &&
    !mappedKeys.includes('priceWholesale') &&
    !mappedKeys.includes('priceWholesale2') &&
    !mappedKeys.includes('priceWholesale3')
  ) {
    throw new ImportError('Не знайдено колонку з ціною', 400);
  }

  const headers = Object.keys(rawRows[0]);
  const diff = await buildPriceDiff(rawRows, columnMapping);

  return {
    headers,
    totalRows: rawRows.length,
    changedCount: diff.changedCount,
    unchangedCount: diff.unchangedCount,
    missingCount: diff.missingCount,
    sample: diff.sample,
  };
}

async function buildPriceDiff(
  rawRows: ExcelRow[],
  columnMapping: Record<string, string>,
): Promise<{
  sample: PriceDiffRow[];
  changedCount: number;
  unchangedCount: number;
  missingCount: number;
}> {
  const normalized = rawRows.map((raw) => {
    const out: Record<string, unknown> = {};
    for (const [header, key] of Object.entries(columnMapping)) out[key] = raw[header];
    return out;
  });

  const codes = normalized.map((r) => String(r.code ?? '').trim()).filter(Boolean);
  const existing = await prisma.product.findMany({
    where: { code: { in: codes } },
    select: {
      code: true,
      name: true,
      priceRetail: true,
      priceWholesale: true,
      priceWholesale2: true,
      priceWholesale3: true,
    },
  });
  const byCode = new Map(existing.map((p) => [p.code, p]));

  let changedCount = 0;
  let unchangedCount = 0;
  let missingCount = 0;
  const sample: PriceDiffRow[] = [];

  for (const row of normalized) {
    const code = String(row.code ?? '').trim();
    if (!code) continue;
    const product = byCode.get(code);
    const newRetail = parsePrice(row.priceRetail);
    const newWholesale = parsePrice(row.priceWholesale);
    const newWholesale2 = parsePrice(row.priceWholesale2);
    const newWholesale3 = parsePrice(row.priceWholesale3);

    if (!product) {
      missingCount++;
      if (sample.length < 50) {
        sample.push({
          code,
          name: null,
          oldRetail: null,
          newRetail,
          oldWholesale: null,
          newWholesale,
          oldWholesale2: null,
          newWholesale2,
          oldWholesale3: null,
          newWholesale3,
          status: 'missing',
        });
      }
      continue;
    }

    const oldRetail = Number(product.priceRetail);
    const oldWholesale = product.priceWholesale != null ? Number(product.priceWholesale) : null;
    const oldWholesale2 = product.priceWholesale2 != null ? Number(product.priceWholesale2) : null;
    const oldWholesale3 = product.priceWholesale3 != null ? Number(product.priceWholesale3) : null;

    const hasChange =
      (newRetail !== null && newRetail !== oldRetail) ||
      (newWholesale !== null && newWholesale !== oldWholesale) ||
      (newWholesale2 !== null && newWholesale2 !== oldWholesale2) ||
      (newWholesale3 !== null && newWholesale3 !== oldWholesale3);

    if (hasChange) changedCount++;
    else unchangedCount++;

    if (sample.length < 50) {
      sample.push({
        code,
        name: product.name,
        oldRetail,
        newRetail,
        oldWholesale,
        newWholesale,
        oldWholesale2,
        newWholesale2,
        oldWholesale3,
        newWholesale3,
        status: hasChange ? 'changed' : 'unchanged',
      });
    }
  }

  return { sample, changedCount, unchangedCount, missingCount };
}

/**
 * Public entry for price-only mass updates. Parses a price-only file, then
 * runs the lightweight update path: only prices change, no products are
 * created, missing codes are reported as warnings.
 */
export async function importPrices(
  fileBuffer: Buffer,
  filename: string,
  managerId: number,
): Promise<ImportResult> {
  const startTime = Date.now();
  const rows = await parsePriceRows(fileBuffer);

  const importLog = await prisma.importLog.create({
    data: {
      managerId,
      filename,
      fileSizeBytes: fileBuffer.length,
      status: 'processing_import',
      startedAt: new Date(),
    },
  });

  try {
    return await runPriceOnlyImport({ rows, importLogId: importLog.id, startTime });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    await prisma.importLog.update({
      where: { id: importLog.id },
      data: {
        status: 'failed_import',
        errorCount: 1,
        errorsJson: [
          {
            row: 0,
            field: 'file',
            message: error instanceof Error ? error.message : 'Помилка імпорту',
          },
        ],
        completedAt: new Date(),
        durationMs,
      },
    });
    if (error instanceof ImportError) throw error;
    throw new ImportError('Помилка при обробці файлу', 500);
  }
}

/**
 * Fast path for price-only files (code + price columns). Updates prices on
 * existing products, records price history. Missing codes are reported as
 * warnings, not errors — operators commonly upload trimmed supplier sheets.
 */
async function runPriceOnlyImport(opts: {
  rows: Record<string, unknown>[];
  importLogId: number;
  startTime: number;
}): Promise<ImportResult> {
  const { rows, importLogId, startTime } = opts;
  const errors: ImportRowError[] = [];
  let updated = 0;
  let skipped = 0;

  const codes = rows.map((r) => String(r.code ?? '').trim()).filter(Boolean);
  const existing = await prisma.product.findMany({
    where: { code: { in: codes } },
    select: {
      id: true,
      code: true,
      priceRetail: true,
      priceWholesale: true,
      priceWholesale2: true,
      priceWholesale3: true,
    },
  });
  const byCode = new Map(existing.map((p) => [p.code, p]));

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i];
    const code = String(row.code ?? '').trim();

    if (!code) {
      errors.push({ row: rowNum, field: 'code', message: "Код продукції обов'язковий" });
      skipped++;
      continue;
    }

    const product = byCode.get(code);
    if (!product) {
      errors.push({
        row: rowNum,
        field: 'code',
        message: 'Товар не знайдено — пропущено',
        value: code,
      });
      skipped++;
      continue;
    }

    const newRetail = parsePrice(row.priceRetail);
    const newWholesale = parsePrice(row.priceWholesale);
    const newWholesale2 = parsePrice(row.priceWholesale2);
    const newWholesale3 = parsePrice(row.priceWholesale3);

    if (
      newRetail === null &&
      newWholesale === null &&
      newWholesale2 === null &&
      newWholesale3 === null
    ) {
      errors.push({ row: rowNum, field: 'price', message: 'Жодної ціни не вказано' });
      skipped++;
      continue;
    }

    const updateData: Record<string, unknown> = {};
    const oldRetail = Number(product.priceRetail);
    const oldWholesale = product.priceWholesale != null ? Number(product.priceWholesale) : null;
    const oldWholesale2 = product.priceWholesale2 != null ? Number(product.priceWholesale2) : null;
    const oldWholesale3 = product.priceWholesale3 != null ? Number(product.priceWholesale3) : null;

    let retailChanged = false;
    let wholesaleChanged = false;
    if (newRetail !== null && newRetail !== oldRetail) {
      updateData.priceRetail = newRetail;
      updateData.priceRetailOld = product.priceRetail;
      retailChanged = true;
    }
    if (newWholesale !== null && newWholesale !== oldWholesale) {
      updateData.priceWholesale = newWholesale;
      updateData.priceWholesaleOld = product.priceWholesale;
      wholesaleChanged = true;
    }
    if (newWholesale2 !== null && newWholesale2 !== oldWholesale2) {
      updateData.priceWholesale2 = newWholesale2;
      updateData.priceWholesaleOld2 = product.priceWholesale2;
      wholesaleChanged = true;
    }
    if (newWholesale3 !== null && newWholesale3 !== oldWholesale3) {
      updateData.priceWholesale3 = newWholesale3;
      updateData.priceWholesaleOld3 = product.priceWholesale3;
      wholesaleChanged = true;
    }

    if (Object.keys(updateData).length === 0) {
      skipped++;
      continue;
    }

    await prisma.product.update({ where: { id: product.id }, data: updateData });

    if (retailChanged || wholesaleChanged) {
      await prisma.priceHistory.create({
        data: {
          productId: product.id,
          priceRetailOld: product.priceRetail,
          priceRetailNew: retailChanged ? newRetail! : Number(product.priceRetail),
          priceWholesaleOld: product.priceWholesale,
          priceWholesaleNew: newWholesale ?? product.priceWholesale,
          importId: importLogId,
        },
      });
    }
    updated++;
  }

  const durationMs = Date.now() - startTime;
  await prisma.importLog.update({
    where: { id: importLogId },
    data: {
      status: 'completed_import',
      totalRows: rows.length,
      createdCount: 0,
      updatedCount: updated,
      skippedCount: skipped,
      errorCount: errors.length,
      errorsJson: errors.length > 0 ? JSON.parse(JSON.stringify(errors)) : undefined,
      completedAt: new Date(),
      durationMs,
    },
  });

  await cacheInvalidate('products:*');
  revalidatePath('/catalog', 'layout');
  revalidatePath('/', 'layout');

  return {
    importLogId,
    totalRows: rows.length,
    created: 0,
    updated,
    skipped,
    imagesImported: 0,
    imagesFailed: 0,
    errors,
    durationMs,
  };
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
  managerId: number,
  options?: { dryRun?: boolean },
): Promise<ImportResult & { dryRun?: boolean }> {
  const startTime = Date.now();
  const dryRun = options?.dryRun === true;

  // Dry-run does not create an ImportLog or write any product. It re-uses the
  // parser/validator + finds-by-code/barcode to compute what WOULD happen, then
  // returns counts so the operator can confirm before committing.
  const importLog = dryRun
    ? { id: 0 } // sentinel; never persisted
    : await prisma.importLog.create({
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
  let variantsCreated = 0;
  let variantsUpdated = 0;
  // Track which products were touched so we can roll back later.
  const createdProductIds: number[] = [];
  const updatedProductIds: number[] = [];

  try {
    const { rows, format } = await parseRows(fileBuffer);
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
          errors.push({ row: rowNum, field: 'code', message: "Код продукції обов'язковий" });
          skipped++;
          continue;
        }
        if (code.length > 50) {
          errors.push({
            row: rowNum,
            field: 'code',
            message: 'Код продукції занадто довгий (макс. 50)',
            value: code,
          });
          skipped++;
          continue;
        }

        // Validate name
        const name = String(row.name ?? '').trim();
        if (!name) {
          errors.push({ row: rowNum, field: 'name', message: "Назва товару обов'язкова" });
          skipped++;
          continue;
        }

        // Validate prices — in supplier format, at least one price is enough
        const priceRetail = parsePrice(row.priceRetail);
        const priceWholesale = parsePrice(row.priceWholesale);
        const priceWholesale2 = parsePrice(row.priceWholesale2);
        const priceWholesale3 = parsePrice(row.priceWholesale3);

        if (isSupplierFormat) {
          if (priceRetail === null && priceWholesale === null) {
            errors.push({
              row: rowNum,
              field: 'price',
              message: 'Немає жодної ціни',
              value: row.priceRetail,
            });
            skipped++;
            continue;
          }
        } else {
          if (priceRetail === null) {
            errors.push({
              row: rowNum,
              field: 'priceRetail',
              message: 'Невірна роздрібна ціна',
              value: row.priceRetail,
            });
            skipped++;
            continue;
          }
        }

        // Optional fields
        const quantity = parseQuantity(row.quantity);
        const isPromo = parsePromo(row.isPromo);

        // Variant rows: when a row carries `variant_sku`, treat it as a child
        // SKU of the parent product (matched by `code`), not as a new product.
        // The parent must already exist — variants don't auto-create parents
        // (that would create a phantom product with no real category).
        const variantSku = String(row.variantSku ?? '').trim();
        if (variantSku) {
          const parent = await prisma.product.findUnique({ where: { code }, select: { id: true } });
          if (!parent) {
            errors.push({
              row: rowNum,
              field: 'code',
              message: `Варіант "${variantSku}": батьківський товар з кодом "${code}" не знайдено`,
              value: code,
            });
            skipped++;
            continue;
          }

          const variantBarcodeRaw = String(row.variantBarcode ?? '').trim().replace(/\D+/g, '');
          const variantBarcode = /^\d{8,14}$/.test(variantBarcodeRaw) ? variantBarcodeRaw : null;

          const options: Record<string, string> = {};
          const size = String(row.variantSize ?? '').trim();
          const color = String(row.variantColor ?? '').trim();
          const flavour = String(row.variantFlavour ?? '').trim();
          if (size) options.size = size;
          if (color) options.color = color;
          if (flavour) options.flavour = flavour;

          // Build a sensible display name: "ProductName · Size M · Red".
          const variantName = String(row.variantName ?? '').trim() || (() => {
            const parts = [size, color, flavour].filter(Boolean);
            return parts.length ? `${name} · ${parts.join(' · ')}` : name;
          })();

          // Per-variant physical params. Fall back to integer parsing — if the
          // column is missing or empty, leave null so the parent product's
          // params are used for TTN calculations.
          const variantWeightRaw = Number(row.variantWeightGrams);
          const variantWeight = Number.isFinite(variantWeightRaw) && variantWeightRaw > 0
            ? Math.round(variantWeightRaw)
            : null;
          const variantCost = parsePrice(row.variantCost);

          if (!dryRun) {
            const existingVariant = await prisma.productVariant.findUnique({
              where: { sku: variantSku },
              select: { id: true, productId: true },
            });

            if (existingVariant) {
              await prisma.productVariant.update({
                where: { id: existingVariant.id },
                data: {
                  productId: parent.id,
                  name: variantName,
                  priceRetail: priceRetail,
                  priceWholesale: priceWholesale,
                  quantity,
                  options: Object.keys(options).length ? options : undefined,
                  ...(variantBarcode ? { barcode: variantBarcode } : {}),
                  ...(variantWeight !== null ? { weightGrams: variantWeight } : {}),
                  ...(variantCost !== null ? { cost: variantCost } : {}),
                },
              });
              variantsUpdated++;
            } else {
              await prisma.productVariant.create({
                data: {
                  productId: parent.id,
                  sku: variantSku,
                  name: variantName,
                  priceRetail: priceRetail,
                  priceWholesale: priceWholesale,
                  quantity,
                  options: Object.keys(options).length ? options : undefined,
                  barcode: variantBarcode,
                  weightGrams: variantWeight,
                  cost: variantCost,
                },
              });
              variantsCreated++;
            }
          } else {
            // dry-run still increments counts so the report tells the operator
            // how many variants the file would produce.
            const exists = await prisma.productVariant.findUnique({
              where: { sku: variantSku },
              select: { id: true },
            });
            if (exists) variantsUpdated++;
            else variantsCreated++;
          }

          continue; // skip the rest of the product create/update path
        }

        // Handle category
        let categoryId: number | null = null;
        const categoryName = String(row.category ?? '').trim();
        if (categoryName) {
          const existingCatId = categoryMap.get(categoryName.toLowerCase());
          if (existingCatId) {
            categoryId = existingCatId;
          } else if (!dryRun) {
            // Auto-create category. Resolve slug conflicts with -2, -3, … so
            // the resulting URL stays human-readable (the previous Date.now()
            // suffix produced ugly numeric tails).
            const baseSlug = createSlug(categoryName);
            let finalSlug = baseSlug;
            for (let suffix = 2; suffix < 1000; suffix++) {
              const exists = await prisma.category.findUnique({
                where: { slug: finalSlug },
              });
              if (!exists) break;
              finalSlug = `${baseSlug}-${suffix}`;
            }
            const newCategory = await prisma.category.create({
              data: { name: categoryName, slug: finalSlug },
            });
            categoryId = newCategory.id;
            categoryMap.set(categoryName.toLowerCase(), newCategory.id);
          }
          // In dry-run: categoryId stays null when the category does not yet
          // exist — the report will say "would create category X" implicitly
          // because the row counts as create, not update.
        }

        // Parse barcode (EAN-8/UPC-A/EAN-13). Optional column in import.
        const barcodeRaw = String(row.barcode ?? '').trim().replace(/\D+/g, '');
        const barcode = /^\d{8,14}$/.test(barcodeRaw) ? barcodeRaw : null;

        // Check if product exists. Priority of matching:
        //  1. by `code` (canonical)
        //  2. by `barcode` (unique, prevents duplicates across supplier formats)
        //  3. by `name` (supplier format fallback, fuzzy)
        let existingProduct = await prisma.product.findUnique({ where: { code } });
        if (!existingProduct && barcode) {
          existingProduct = await prisma.product.findUnique({ where: { barcode } });
        }
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
          // Only set barcode if not already present — never overwrite a barcode
          // the admin/another import already assigned.
          if (barcode && !existingProduct.barcode) {
            updateData.barcode = barcode;
          }

          // Track price changes
          if (priceRetail !== null) {
            if (Number(existingProduct.priceRetail) !== priceRetail) {
              updateData.priceRetailOld = existingProduct.priceRetail;
              updateData.priceRetail = priceRetail;

              if (!dryRun) {
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
              }
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

          if (priceWholesale2 !== null) {
            if (Number(existingProduct.priceWholesale2) !== priceWholesale2) {
              updateData.priceWholesaleOld2 = existingProduct.priceWholesale2;
            }
            updateData.priceWholesale2 = priceWholesale2;
          }

          if (priceWholesale3 !== null) {
            if (Number(existingProduct.priceWholesale3) !== priceWholesale3) {
              updateData.priceWholesaleOld3 = existingProduct.priceWholesale3;
            }
            updateData.priceWholesale3 = priceWholesale3;
          }

          // Update slug if name changed
          if (existingProduct.name !== name) {
            const slug = createSlug(name);
            const slugExists = await prisma.product.findFirst({
              where: { slug, id: { not: existingProduct.id } },
            });
            updateData.slug = slugExists ? `${slug}-${code.toLowerCase()}` : slug;
          }

          if (!dryRun) {
            await prisma.product.update({
              where: { id: existingProduct.id },
              data: updateData,
            });
            updatedProductIds.push(existingProduct.id);

            // Upsert content fields if provided
            const contentData = buildContentData(row);
            if (contentData) {
              await prisma.productContent.upsert({
                where: { productId: existingProduct.id },
                update: contentData,
                create: { productId: existingProduct.id, ...contentData },
              });
            }

            // Download image if URL provided
            const imageUrl = String(row.imageUrl ?? '').trim();
            if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
              const success = await downloadAndProcessImage(imageUrl, existingProduct.id);
              if (success) imagesImported++;
              else imagesFailed++;
            }
          }

          updated++;
        } else {
          if (!dryRun) {
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
                barcode: barcode || null,
                categoryId,
                priceRetail: priceRetail ?? 0,
                priceWholesale,
                priceWholesale2,
                priceWholesale3,
                quantity,
                isPromo,
              },
            });
            createdProductIds.push(newProduct.id);

            // Create content if provided
            const contentData = buildContentData(row);
            if (contentData) {
              await prisma.productContent.create({
                data: { productId: newProduct.id, ...contentData },
              });
            }

            // Download image if URL provided
            const imageUrl = String(row.imageUrl ?? '').trim();
            if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
              const success = await downloadAndProcessImage(imageUrl, newProduct.id);
              if (success) imagesImported++;
              else imagesFailed++;
            }
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

    // Update import log (skipped for dry-run — no log row exists)
    if (!dryRun) {
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
          createdProductIds,
          updatedProductIds,
          completedAt: new Date(),
          durationMs,
        },
      });

      // Invalidate Redis cache + Next.js page cache after import
      await cacheInvalidate('products:*');
      await cacheInvalidate('categories:*');
      revalidatePath('/catalog', 'layout');
      revalidatePath('/', 'layout');
    }

    return {
      importLogId: importLog.id,
      totalRows: rows.length,
      created,
      updated,
      skipped,
      imagesImported,
      imagesFailed,
      variantsCreated,
      variantsUpdated,
      errors,
      durationMs,
      ...(dryRun ? { dryRun: true } : {}),
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    if (!dryRun) {
      await prisma.importLog.update({
        where: { id: importLog.id },
        data: {
          status: 'failed_import',
          errorCount: 1,
          errorsJson: [
            {
              row: 0,
              field: 'file',
              message: error instanceof Error ? error.message : 'Помилка імпорту',
            },
          ],
          completedAt: new Date(),
          durationMs,
        },
      });
    }

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

/**
 * Roll back a completed import:
 *  • newly-created products → soft-deleted (isActive=false, deletedAt set)
 *  • updated products → prices reverted using PriceHistory entries that
 *    carry this importId
 *
 * Not rolled back: stock counts (quantity), descriptions, images, categories.
 * Those changes have no per-import audit trail yet — reverting them blindly
 * would risk discarding legitimate parallel edits made after the import.
 *
 * Idempotent: if `rollbackedAt` is already set, throws — caller should refresh
 * the page rather than re-rolling back.
 */
export async function rollbackImport(
  importLogId: number,
  rollbackedBy: number,
): Promise<{
  softDeletedCount: number;
  pricesRevertedCount: number;
}> {
  const log = await prisma.importLog.findUnique({ where: { id: importLogId } });
  if (!log) throw new ImportError('Лог імпорту не знайдено', 404);
  if (log.rollbackedAt) {
    throw new ImportError('Цей імпорт вже скасовано', 409);
  }
  if (log.status !== 'completed_import') {
    throw new ImportError('Скасувати можна тільки успішно завершений імпорт', 400);
  }

  // 1. Soft-delete newly-created products. Skip ones a human may have edited
  // since import: if the product already has orderItems or cartItems, don't
  // touch it — operator can clean up manually.
  let softDeletedCount = 0;
  if (log.createdProductIds.length > 0) {
    const safeToDelete = await prisma.product.findMany({
      where: {
        id: { in: log.createdProductIds },
        deletedAt: null,
        orderItems: { none: {} },
        cartItems: { none: {} },
      },
      select: { id: true },
    });
    if (safeToDelete.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: safeToDelete.map((p) => p.id) } },
        data: { isActive: false, deletedAt: new Date() },
      });
      softDeletedCount = safeToDelete.length;
    }
  }

  // 2. Revert prices for updated products. PriceHistory carries importId,
  // so we reverse each change.
  const priceChanges = await prisma.priceHistory.findMany({
    where: { importId: importLogId },
    orderBy: { id: 'asc' },
  });

  let pricesRevertedCount = 0;
  for (const change of priceChanges) {
    const updateData: Record<string, unknown> = {};
    if (change.priceRetailOld != null) updateData.priceRetail = change.priceRetailOld;
    if (change.priceWholesaleOld != null) updateData.priceWholesale = change.priceWholesaleOld;
    if (change.priceWholesale2Old != null) updateData.priceWholesale2 = change.priceWholesale2Old;
    if (change.priceWholesale3Old != null) updateData.priceWholesale3 = change.priceWholesale3Old;

    if (Object.keys(updateData).length > 0) {
      try {
        await prisma.product.update({
          where: { id: change.productId },
          data: updateData,
        });
        pricesRevertedCount++;
      } catch {
        // Product may have been deleted — skip silently.
      }
    }
  }

  await prisma.importLog.update({
    where: { id: importLogId },
    data: { rollbackedAt: new Date(), rollbackedBy },
  });

  await cacheInvalidate('products:*');
  revalidatePath('/catalog', 'layout');
  revalidatePath('/', 'layout');

  return { softDeletedCount, pricesRevertedCount };
}

