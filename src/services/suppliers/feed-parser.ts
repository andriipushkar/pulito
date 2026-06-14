import { XMLParser } from 'fast-xml-parser';
import type { SupplierFormat } from '@/../generated/prisma';
import { SupplierChannelError } from '@/services/suppliers/feed-source';
import { decodeFeedBuffer, parseFeedPrice, parseFeedQuantity } from '@/utils/feed-parse';

/**
 * One product line extracted from a supplier feed, normalised so the sync
 * engine never has to know the source format. This is intentionally narrow:
 * the consignment sync only drives PURCHASE PRICE + STOCK of products that are
 * already linked by `sku`. It never carries catalog content (name/barcode are
 * hints for the manual first-import matching UI only, not written on sync).
 */
export interface NormalizedSupplierItem {
  /** Supplier's own SKU/article — the matching key against Product.supplierSku. */
  sku: string;
  /** Supplier's price to us (→ Product.cost). null = feed omitted/zeroed it. */
  purchasePrice: number | null;
  /** Units the supplier reports on hand. */
  quantity: number;
  /** Whether the supplier marks the line sellable (independent of quantity). */
  available: boolean;
  /** Display name — used only to help a human confirm the SKU→product link. */
  name: string | null;
  /** Barcode/GTIN — optional secondary matching hint. */
  barcode: string | null;
}

const MAX_OFFERS = 10_000;

// Shared, locale-aware primitives (single source of truth across importers).
const decodeBuffer = decodeFeedBuffer;
const parsePrice = parseFeedPrice;
const parseQuantity = parseFeedQuantity;

function nonEmpty(value: unknown): string | null {
  const s = String(value ?? '').trim();
  return s || null;
}

// ─────────────────────────────────────────────────────────────────────────
// YML (Yandex Market) — XML, the de-facto UA B2B wholesale standard
// ─────────────────────────────────────────────────────────────────────────

type YmlOffer = {
  '@_id'?: string | number;
  '@_available'?: string | boolean;
  name?: string;
  vendorCode?: string | number;
  barcode?: string | number;
  price?: string | number;
  purchase_price?: string | number;
  quantity_in_stock?: string | number;
  stock_quantity?: string | number;
};

function xmlParser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    parseAttributeValue: false,
    // XXE guard — never resolve external entities from an untrusted feed.
    processEntities: false,
    isArray: (name) =>
      ['offer', 'category', 'param', 'picture', 'Товар', 'Предложение', 'Цена', 'Склад'].includes(
        name,
      ),
  });
}

function parseYml(buffer: Buffer): NormalizedSupplierItem[] {
  let doc: unknown;
  try {
    doc = xmlParser().parse(decodeBuffer(buffer));
  } catch (err) {
    throw new SupplierChannelError(
      `Невалідний XML: ${err instanceof Error ? err.message : 'parse error'}`,
      400,
    );
  }

  const root = (doc as { yml_catalog?: { shop?: { offers?: { offer?: YmlOffer[] } } } })
    .yml_catalog;
  if (!root) {
    throw new SupplierChannelError('Підтримується тільки формат Yandex Market (yml_catalog)', 400);
  }
  const offers = root.shop?.offers?.offer ?? [];
  if (offers.length === 0) throw new SupplierChannelError('YML не містить жодного offer', 400);
  if (offers.length > MAX_OFFERS) {
    throw new SupplierChannelError(`Максимальна кількість offer: ${MAX_OFFERS}`, 400);
  }

  const items: NormalizedSupplierItem[] = [];
  for (const offer of offers) {
    const sku = String(offer.vendorCode ?? offer['@_id'] ?? '').trim();
    if (!sku) continue;

    const quantity = parseQuantity(offer.quantity_in_stock ?? offer.stock_quantity);
    const availRaw = offer['@_available'];
    const available =
      availRaw === undefined || availRaw === null || availRaw === ''
        ? quantity > 0
        : String(availRaw).toLowerCase() === 'true';

    items.push({
      sku,
      purchasePrice: parsePrice(offer.purchase_price ?? offer.price),
      quantity,
      available,
      name: nonEmpty(offer.name),
      barcode: nonEmpty(offer.barcode),
    });
  }
  return items;
}

// ─────────────────────────────────────────────────────────────────────────
// CSV / XLSX (tabular) — also covers Google Sheets published as CSV/XLSX
// ─────────────────────────────────────────────────────────────────────────

type SheetField = 'sku' | 'price' | 'quantity' | 'name' | 'barcode' | 'available';

// Header (lower-cased) → internal field. Covers the common Ukrainian/Russian/
// English column names a supplier price sheet uses.
const COLUMN_SYNONYMS: Record<string, SheetField> = {};
for (const h of [
  'артикул',
  'sku',
  'код',
  'код товару',
  'код продукції',
  'code',
  'id',
  'ид',
  'vendorcode',
  'vendor_code',
])
  COLUMN_SYNONYMS[h] = 'sku';
for (const h of [
  'ціна',
  'цена',
  'price',
  'закупівельна',
  'закупочная',
  'закупка',
  'закуп',
  'purchase_price',
  'опт',
  'оптова',
  'wholesale',
  'ціна закупки',
  'собівартість',
  'себестоимость',
])
  COLUMN_SYNONYMS[h] = 'price';
for (const h of [
  'кількість',
  'количество',
  'залишок',
  'остаток',
  'quantity',
  'qty',
  'stock',
  'кільк',
])
  COLUMN_SYNONYMS[h] = 'quantity';
// Availability is a FLAG column (text/boolean), NOT a number — mapping it to
// quantity made an in-stock product read as 0 ("в наявності" → parseInt → NaN).
for (const h of [
  'наявність',
  'в наявності',
  'наявно',
  'наличие',
  'в наличии',
  'availability',
  'available',
  'в продажу',
  'статус',
  'in_stock',
  'instock',
])
  COLUMN_SYNONYMS[h] = 'available';
for (const h of ['назва', 'наименование', 'название', 'name', 'товар', 'найменування'])
  COLUMN_SYNONYMS[h] = 'name';
for (const h of ['штрихкод', 'штрих-код', 'barcode', 'ean', 'ean-13', 'gtin', 'upc'])
  COLUMN_SYNONYMS[h] = 'barcode';

function mapHeader(raw: string): SheetField | null {
  return COLUMN_SYNONYMS[raw.trim().toLowerCase()] ?? null;
}

/** Parse a textual availability flag → true/false, or null when unrecognised
 *  (caller then falls back to quantity > 0). */
function parseAvailabilityFlag(value: unknown): boolean | null {
  const s = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!s) return null;
  if (
    [
      'так',
      'yes',
      'true',
      '1',
      '+',
      'є',
      'есть',
      'наявно',
      'в наявності',
      'available',
      'в наличии',
      'instock',
      'in stock',
    ].includes(s)
  )
    return true;
  if (
    [
      'ні',
      'no',
      'false',
      '0',
      '-',
      'немає',
      'нема',
      'відсутній',
      'отсутствует',
      'нет',
      'out',
      'out of stock',
    ].includes(s)
  )
    return false;
  // Bare numbers in an availability column: >0 means available.
  const n = Number(s);
  if (Number.isFinite(n)) return n > 0;
  return null;
}

// ExcelJS cell values can be strings, numbers, dates, formula objects or rich
// text. Flatten to a plain primitive for the parsers above.
function normalizeCell(v: unknown): unknown {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('result' in o) return normalizeCell(o.result);
    if ('richText' in o) return (o.richText as { text: string }[]).map((p) => p.text).join('');
    if ('text' in o) return String(o.text ?? '');
    if (v instanceof Date) return v.toISOString();
  }
  return v;
}

interface MinimalRow {
  eachCell(
    opts: { includeEmpty: boolean },
    cb: (cell: { value: unknown }, col: number) => void,
  ): void;
  getCell(col: number): { value: unknown };
}
interface MinimalSheet {
  getRow(n: number): MinimalRow;
  eachRow(opts: { includeEmpty: boolean }, cb: (row: MinimalRow, rowNumber: number) => void): void;
}

function itemsFromSheet(sheet: MinimalSheet | undefined): NormalizedSupplierItem[] {
  if (!sheet) throw new SupplierChannelError('Файл не містить даних', 400);

  const colToField = new Map<number, SheetField>();
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const field = mapHeader(String(normalizeCell(cell.value) ?? ''));
    if (field && ![...colToField.values()].includes(field)) colToField.set(col, field);
  });

  const fields = new Set(colToField.values());
  if (!fields.has('sku')) {
    throw new SupplierChannelError('Не знайдено колонку артикул/SKU', 400);
  }
  if (!fields.has('price') && !fields.has('quantity') && !fields.has('available')) {
    throw new SupplierChannelError('Не знайдено колонку ціни, кількості або наявності', 400);
  }

  const items: NormalizedSupplierItem[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const rec: Record<string, unknown> = {};
    for (const [col, field] of colToField) rec[field] = normalizeCell(row.getCell(col).value);
    const sku = String(rec.sku ?? '').trim();
    if (!sku) return;
    const quantity = parseQuantity(rec.quantity);
    // Explicit availability flag wins; otherwise infer from stock count.
    const availFlag = fields.has('available') ? parseAvailabilityFlag(rec.available) : null;
    items.push({
      sku,
      purchasePrice: parsePrice(rec.price),
      quantity,
      available: availFlag !== null ? availFlag : quantity > 0,
      name: nonEmpty(rec.name),
      barcode: nonEmpty(rec.barcode),
    });
  });

  if (items.length === 0) throw new SupplierChannelError('Файл не містить рядків з даними', 400);
  if (items.length > MAX_OFFERS) {
    throw new SupplierChannelError(`Максимальна кількість рядків: ${MAX_OFFERS}`, 400);
  }
  return items;
}

async function parseXlsx(buffer: Buffer): Promise<NormalizedSupplierItem[]> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch (err) {
    throw new SupplierChannelError(
      `Невалідний XLSX: ${err instanceof Error ? err.message : 'parse error'}`,
      400,
    );
  }
  return itemsFromSheet(workbook.worksheets[0] as unknown as MinimalSheet);
}

async function parseCsv(buffer: Buffer): Promise<NormalizedSupplierItem[]> {
  const text = decodeBuffer(buffer);
  // Sniff the delimiter on the header line — UA exports often use ';'.
  const firstLine = text.slice(0, text.indexOf('\n') >= 0 ? text.indexOf('\n') : text.length);
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const ExcelJS = (await import('exceljs')).default;
  const { Readable } = await import('node:stream');
  const workbook = new ExcelJS.Workbook();
  let sheet: unknown;
  try {
    sheet = await workbook.csv.read(Readable.from(text), { parserOptions: { delimiter } });
  } catch (err) {
    throw new SupplierChannelError(
      `Невалідний CSV: ${err instanceof Error ? err.message : 'parse error'}`,
      400,
    );
  }
  return itemsFromSheet(sheet as MinimalSheet);
}

// ─────────────────────────────────────────────────────────────────────────
// CommerceML (1С / xml_1c) — КоммерческаяИнформация with offers
// ─────────────────────────────────────────────────────────────────────────

function toArray<T>(x: T | T[] | undefined | null): T[] {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

type CmlNode = Record<string, unknown>;

// 1С <Цены> often lists several <Цена> (retail / wholesale / purchase). For a
// consignment COST we want the purchase/wholesale one — prefer a price whose
// type representation names it, falling back to the first parseable price (the
// previous behaviour, so this is never worse).
const PURCHASE_PRICE_KEYWORDS = ['закуп', 'опт', 'wholesale', 'purchase', 'собівар', 'себест'];
function priceFromЦены(ceny: unknown): number | null {
  const prices: { value: number; typeText: string }[] = [];
  for (const c of toArray((ceny as CmlNode)?.['Цена'] as CmlNode | CmlNode[])) {
    const v = c['ЦенаЗаЕдиницу'] ?? c['Цена'] ?? c['ЦенаЗаЕдиницуТовара'];
    const parsed = parsePrice(v);
    if (parsed == null) continue;
    const typeText = String(
      c['Представление'] ?? c['ТипЦены'] ?? c['ИдТипаЦены'] ?? '',
    ).toLowerCase();
    prices.push({ value: parsed, typeText });
  }
  if (prices.length === 0) return null;
  const preferred = prices.find((p) => PURCHASE_PRICE_KEYWORDS.some((k) => p.typeText.includes(k)));
  return (preferred ?? prices[0]).value;
}

function qtyFromOffer(off: CmlNode): number {
  if (off['Количество'] != null) return parseQuantity(off['Количество']);
  // Multi-warehouse: <Склад КоличествоНаСкладе="5"/>
  let sum = 0;
  let found = false;
  for (const w of toArray(off['Склад'] as CmlNode | CmlNode[])) {
    const q = w['@_КоличествоНаСкладе'] ?? w['Количество'];
    if (q != null) {
      found = true;
      sum += parseQuantity(q);
    }
  }
  return found ? sum : 0;
}

// Build items from one or more parsed CommerceML docs. 1С often splits the
// catalog (import.xml) and the offers/prices (offers.xml) into SEPARATE files,
// so we merge the catalog map across all docs before reading offers.
function commerceMLItemsFromDocs(docs: unknown[]): NormalizedSupplierItem[] {
  const roots: CmlNode[] = [];
  for (const doc of docs) {
    const root = (doc as Record<string, CmlNode>)['КоммерческаяИнформация'];
    if (root) roots.push(root);
  }
  if (roots.length === 0) {
    throw new SupplierChannelError('Підтримується тільки CommerceML (КоммерческаяИнформация)', 400);
  }

  // Catalog: Ид → { sku, name, barcode } so offers can borrow display fields.
  const catalogById = new Map<
    string,
    { sku: string; name: string | null; barcode: string | null }
  >();
  for (const root of roots) {
    for (const cat of toArray(root['Каталог'] as CmlNode | CmlNode[])) {
      for (const t of toArray((cat['Товары'] as CmlNode)?.['Товар'] as CmlNode | CmlNode[])) {
        const id = String(t['Ид'] ?? '').trim();
        if (!id) continue;
        const art = String(t['Артикул'] ?? '').trim();
        catalogById.set(id, {
          sku: art || id,
          name: nonEmpty(t['Наименование']),
          barcode: nonEmpty(t['ШтрихКод'] ?? t['Штрихкод']),
        });
      }
    }
  }

  const items: NormalizedSupplierItem[] = [];
  let hasOffers = false;
  for (const root of roots) {
    for (const pkg of toArray(root['ПакетПредложений'] as CmlNode | CmlNode[])) {
      for (const off of toArray(
        (pkg['Предложения'] as CmlNode)?.['Предложение'] as CmlNode | CmlNode[],
      )) {
        hasOffers = true;
        const id = String(off['Ид'] ?? '').trim();
        const baseId = id.split('#')[0];
        const cat = catalogById.get(id) ?? catalogById.get(baseId);
        const sku = (cat?.sku || String(off['Артикул'] ?? '').trim() || id).trim();
        if (!sku) continue;

        const quantity = qtyFromOffer(off);
        items.push({
          sku,
          purchasePrice: priceFromЦены(off['Цены']),
          quantity,
          available: quantity > 0,
          name: cat?.name ?? nonEmpty(off['Наименование']),
          barcode: cat?.barcode ?? null,
        });
      }
    }
  }

  if (!hasOffers) {
    throw new SupplierChannelError('CommerceML без <Предложения> (немає цін/залишків)', 400);
  }
  if (items.length > MAX_OFFERS) {
    throw new SupplierChannelError(`Максимальна кількість пропозицій: ${MAX_OFFERS}`, 400);
  }
  return items;
}

async function parseCommerceML(buffer: Buffer): Promise<NormalizedSupplierItem[]> {
  // 1С commonly delivers a ZIP of import.xml + offers.xml. Detect the PK magic
  // and parse every .xml entry; otherwise treat the buffer as a single XML.
  let xmlStrings: string[];
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(buffer);
    xmlStrings = zip
      .getEntries()
      .filter((e) => !e.isDirectory && /\.xml$/i.test(e.entryName))
      .map((e) => decodeBuffer(e.getData()));
    if (xmlStrings.length === 0) {
      throw new SupplierChannelError('ZIP не містить XML-файлів CommerceML', 400);
    }
  } else {
    xmlStrings = [decodeBuffer(buffer)];
  }

  const parser = xmlParser();
  const docs = xmlStrings.map((s) => {
    try {
      return parser.parse(s);
    } catch (err) {
      throw new SupplierChannelError(
        `Невалідний XML: ${err instanceof Error ? err.message : 'parse error'}`,
        400,
      );
    }
  });
  return commerceMLItemsFromDocs(docs);
}

// ─────────────────────────────────────────────────────────────────────────

/**
 * Parse a supplier feed buffer into normalised price/stock items, dispatching
 * on the channel format. Google Sheets is not a distinct format — publish the
 * sheet as CSV (or XLSX) and use that format.
 */
export async function parseSupplierFeed(
  buffer: Buffer,
  format: SupplierFormat,
): Promise<NormalizedSupplierItem[]> {
  switch (format) {
    case 'yml':
      return parseYml(buffer);
    case 'xml_1c':
      return parseCommerceML(buffer);
    case 'csv':
      return parseCsv(buffer);
    case 'xlsx':
      return parseXlsx(buffer);
    default:
      throw new SupplierChannelError(`Невідомий формат фіду: ${String(format)}`, 400);
  }
}
