import { describe, it, expect } from 'vitest';
import AdmZip from 'adm-zip';
import { parseSupplierFeed, type NormalizedSupplierItem } from './feed-parser';
import { SupplierChannelError } from './feed-source';
import { makeXlsxBuffer } from '@/test/excel-buffer';

function yml(offers: string): Buffer {
  return Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="2026-06-13 12:00">
  <shop>
    <name>Test Supplier</name>
    <categories><category id="1">Хімія</category></categories>
    <offers>${offers}</offers>
  </shop>
</yml_catalog>`,
    'utf8',
  );
}

const bySku = (items: NormalizedSupplierItem[]) => new Map(items.map((i) => [i.sku, i]));

describe('parseSupplierFeed (YML)', () => {
  it('extracts sku/price/qty/available/name/barcode from a basic offer', async () => {
    const items = await parseSupplierFeed(
      yml(`
        <offer id="100" available="true">
          <name>Засіб для миття</name>
          <vendorCode>SUP-A1</vendorCode>
          <barcode>4820000000017</barcode>
          <price>123.45</price>
          <quantity_in_stock>7</quantity_in_stock>
        </offer>`),
      'yml',
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      sku: 'SUP-A1',
      purchasePrice: 123.45,
      quantity: 7,
      available: true,
      name: 'Засіб для миття',
      barcode: '4820000000017',
    });
  });

  it('prefers vendorCode over offer id, falls back to id', async () => {
    const a = await parseSupplierFeed(
      yml(`<offer id="999"><vendorCode>ART-7</vendorCode><price>10</price></offer>`),
      'yml',
    );
    expect(a[0].sku).toBe('ART-7');
    const b = await parseSupplierFeed(
      yml(`<offer id="555"><name>X</name><price>10</price></offer>`),
      'yml',
    );
    expect(b[0].sku).toBe('555');
  });

  it('prefers purchase_price over price for cost', async () => {
    const items = await parseSupplierFeed(
      yml(
        `<offer id="1"><vendorCode>A</vendorCode><price>200</price><purchase_price>150</purchase_price></offer>`,
      ),
      'yml',
    );
    expect(items[0].purchasePrice).toBe(150);
  });

  it('treats zero / garbage price as null and parses comma decimals', async () => {
    const items = await parseSupplierFeed(
      yml(`
        <offer id="1"><vendorCode>ZERO</vendorCode><price>0</price><quantity_in_stock>3</quantity_in_stock></offer>
        <offer id="2"><vendorCode>CMA</vendorCode><price>1 299,90</price><stock_quantity>12</stock_quantity></offer>`),
      'yml',
    );
    const m = bySku(items);
    expect(m.get('ZERO')!.purchasePrice).toBeNull();
    expect(m.get('CMA')!.purchasePrice).toBe(1299.9);
    expect(m.get('CMA')!.quantity).toBe(12);
  });

  it('derives availability from stock and honours available="false"', async () => {
    const items = await parseSupplierFeed(
      yml(`
        <offer id="1"><vendorCode>HAS</vendorCode><price>10</price><quantity_in_stock>5</quantity_in_stock></offer>
        <offer id="2"><vendorCode>NONE</vendorCode><price>10</price><quantity_in_stock>0</quantity_in_stock></offer>
        <offer id="3" available="false"><vendorCode>FORCED</vendorCode><price>10</price><quantity_in_stock>9</quantity_in_stock></offer>`),
      'yml',
    );
    const m = bySku(items);
    expect(m.get('HAS')!.available).toBe(true);
    expect(m.get('NONE')!.available).toBe(false);
    expect(m.get('FORCED')!.available).toBe(false);
    expect(m.get('FORCED')!.quantity).toBe(9);
  });

  it('skips offers without any sku', async () => {
    const items = await parseSupplierFeed(
      yml(`
        <offer available="true"><name>No id</name><price>10</price></offer>
        <offer id="2"><vendorCode>KEEP</vendorCode><price>10</price></offer>`),
      'yml',
    );
    expect(items.map((i) => i.sku)).toEqual(['KEEP']);
  });

  it('is XXE-safe — rejects external entities', async () => {
    const malicious = Buffer.from(
      `<?xml version="1.0"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<yml_catalog><shop><offers><offer id="1"><vendorCode>&xxe;</vendorCode><price>10</price></offer></offers></shop></yml_catalog>`,
      'utf8',
    );
    await expect(parseSupplierFeed(malicious, 'yml')).rejects.toThrow(SupplierChannelError);
  });

  it('rejects non-YML XML and empty offers', async () => {
    await expect(parseSupplierFeed(Buffer.from('<rss><channel/></rss>'), 'yml')).rejects.toThrow(
      SupplierChannelError,
    );
    await expect(parseSupplierFeed(yml(''), 'yml')).rejects.toThrow(/жодного offer/);
  });
});

describe('parseSupplierFeed (CSV)', () => {
  it('maps Ukrainian headers and extracts items (comma-delimited)', async () => {
    const csv = Buffer.from(
      'Артикул,Назва,Ціна,Кількість,Штрихкод\nA1,Засіб,123.45,7,4820000000017\nB2,Інше,0,0,\n',
      'utf8',
    );
    const items = await parseSupplierFeed(csv, 'csv');
    const m = bySku(items);
    expect(m.get('A1')).toEqual({
      sku: 'A1',
      purchasePrice: 123.45,
      quantity: 7,
      available: true,
      name: 'Засіб',
      barcode: '4820000000017',
    });
    // zero price → null, zero qty → not available
    expect(m.get('B2')!.purchasePrice).toBeNull();
    expect(m.get('B2')!.available).toBe(false);
  });

  it('sniffs the semicolon delimiter', async () => {
    const csv = Buffer.from('sku;price;quantity\nX-1;99,50;4\n', 'utf8');
    const items = await parseSupplierFeed(csv, 'csv');
    expect(items[0]).toMatchObject({ sku: 'X-1', purchasePrice: 99.5, quantity: 4 });
  });

  it('throws when no SKU column is present', async () => {
    const csv = Buffer.from('Назва,Ціна\nЩось,10\n', 'utf8');
    await expect(parseSupplierFeed(csv, 'csv')).rejects.toThrow(/артикул/i);
  });

  it('reads a textual "наявність" column as an availability flag, not quantity', async () => {
    const csv = Buffer.from('Артикул;Ціна;Наявність\nA1;100;в наявності\nB2;100;немає\n', 'utf8');
    const items = await parseSupplierFeed(csv, 'csv');
    const m = bySku(items);
    expect(m.get('A1')!.available).toBe(true);
    expect(m.get('B2')!.available).toBe(false);
    // quantity is unknown from a flag column → 0, but availability is preserved.
    expect(m.get('A1')!.quantity).toBe(0);
  });
});

describe('parseSupplierFeed (XLSX)', () => {
  it('reads an Excel price sheet', async () => {
    const buf = await makeXlsxBuffer([{ Артикул: 'X1', Назва: 'Товар', Ціна: 250, Кількість: 3 }]);
    const items = await parseSupplierFeed(buf, 'xlsx');
    expect(items[0]).toMatchObject({ sku: 'X1', purchasePrice: 250, quantity: 3, available: true });
  });
});

describe('parseSupplierFeed (CommerceML / xml_1c)', () => {
  const cml = (offers: string, catalog = '') =>
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?>
<КоммерческаяИнформация ВерсияСхемы="2.05">
  <Каталог><Товары>${catalog}</Товары></Каталог>
  <ПакетПредложений><Предложения>${offers}</Предложения></ПакетПредложений>
</КоммерческаяИнформация>`,
      'utf8',
    );

  it('extracts sku/price/qty from offers, borrowing name+barcode from the catalog', async () => {
    const buf = cml(
      `<Предложение>
         <Ид>g-1</Ид>
         <Цены><Цена><ЦенаЗаЕдиницу>320.00</ЦенаЗаЕдиницу></Цена></Цены>
         <Количество>8</Количество>
       </Предложение>`,
      `<Товар><Ид>g-1</Ид><Артикул>ART-1</Артикул><Наименование>Порошок</Наименование><ШтрихКод>4820000000024</ШтрихКод></Товар>`,
    );
    const items = await parseSupplierFeed(buf, 'xml_1c');
    expect(items[0]).toEqual({
      sku: 'ART-1',
      purchasePrice: 320,
      quantity: 8,
      available: true,
      name: 'Порошок',
      barcode: '4820000000024',
    });
  });

  it('matches catalog by base id when the offer id has a #characteristic suffix', async () => {
    const buf = cml(
      `<Предложение><Ид>g-2#c-9</Ид><Цены><Цена><ЦенаЗаЕдиницу>10</ЦенаЗаЕдиницу></Цена></Цены><Количество>1</Количество></Предложение>`,
      `<Товар><Ид>g-2</Ид><Артикул>ART-2</Артикул><Наименование>Гель</Наименование></Товар>`,
    );
    const items = await parseSupplierFeed(buf, 'xml_1c');
    expect(items[0].sku).toBe('ART-2');
  });

  it('prefers the wholesale/purchase price when several price types are listed', async () => {
    const buf = cml(
      `<Предложение><Ид>g-9</Ид><Артикул>ART-9</Артикул>
         <Цены>
           <Цена><Представление>Роздрібна</Представление><ЦенаЗаЕдиницу>500</ЦенаЗаЕдиницу></Цена>
           <Цена><Представление>Закупівельна</Представление><ЦенаЗаЕдиницу>300</ЦенаЗаЕдиницу></Цена>
         </Цены>
         <Количество>1</Количество>
       </Предложение>`,
    );
    const items = await parseSupplierFeed(buf, 'xml_1c');
    expect(items[0].purchasePrice).toBe(300);
  });

  it('sums multi-warehouse Склад quantities', async () => {
    const buf = cml(
      `<Предложение><Ид>g-3</Ид><Артикул>ART-3</Артикул>
         <Цены><Цена><ЦенаЗаЕдиницу>5</ЦенаЗаЕдиницу></Цена></Цены>
         <Склад КоличествоНаСкладе="2"/><Склад КоличествоНаСкладе="3"/>
       </Предложение>`,
    );
    const items = await parseSupplierFeed(buf, 'xml_1c');
    expect(items[0]).toMatchObject({ sku: 'ART-3', quantity: 5 });
  });

  it('reads a ZIP of split import.xml (catalog) + offers.xml (prices/stock)', async () => {
    const catalogXml = `<?xml version="1.0" encoding="UTF-8"?>
<КоммерческаяИнформация><Каталог><Товары>
  <Товар><Ид>z-1</Ид><Артикул>ZIP-1</Артикул><Наименование>Мило</Наименование><ШтрихКод>4820000000031</ШтрихКод></Товар>
</Товары></Каталог></КоммерческаяИнформация>`;
    const offersXml = `<?xml version="1.0" encoding="UTF-8"?>
<КоммерческаяИнформация><ПакетПредложений><Предложения>
  <Предложение><Ид>z-1</Ид><Цены><Цена><ЦенаЗаЕдиницу>77</ЦенаЗаЕдиницу></Цена></Цены><Количество>4</Количество></Предложение>
</Предложения></ПакетПредложений></КоммерческаяИнформация>`;
    const zip = new AdmZip();
    zip.addFile('import.xml', Buffer.from(catalogXml, 'utf8'));
    zip.addFile('offers.xml', Buffer.from(offersXml, 'utf8'));

    const items = await parseSupplierFeed(zip.toBuffer(), 'xml_1c');
    expect(items[0]).toEqual({
      sku: 'ZIP-1',
      purchasePrice: 77,
      quantity: 4,
      available: true,
      name: 'Мило',
      barcode: '4820000000031',
    });
  });

  it('rejects CommerceML without offers and non-CommerceML XML', async () => {
    const noOffers = Buffer.from(
      `<КоммерческаяИнформация><Каталог><Товары><Товар><Ид>1</Ид></Товар></Товары></Каталог></КоммерческаяИнформация>`,
      'utf8',
    );
    await expect(parseSupplierFeed(noOffers, 'xml_1c')).rejects.toThrow(/Предложения/);
    await expect(parseSupplierFeed(Buffer.from('<rss/>'), 'xml_1c')).rejects.toThrow(/CommerceML/);
  });
});

// Encode a Unicode string to windows-1251 bytes (covers Cyrillic + UA letters)
// so we can exercise the cp1251 decode path without an iconv dependency.
function cp1251(str: string): Buffer {
  const extra: Record<number, number> = {
    0x0490: 0xa5,
    0x0491: 0xb4,
    0x0404: 0xaa,
    0x0454: 0xba,
    0x0406: 0xb2,
    0x0456: 0xb3,
    0x0407: 0xaf,
    0x0457: 0xbf,
    0x0401: 0xa8,
    0x0451: 0xb8,
  };
  const bytes: number[] = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) bytes.push(cp);
    else if (cp >= 0x0410 && cp <= 0x044f) bytes.push(cp - 0x0410 + 0xc0);
    else if (extra[cp] !== undefined) bytes.push(extra[cp]);
    else bytes.push(0x3f);
  }
  return Buffer.from(bytes);
}

describe('parseSupplierFeed (windows-1251 decoding)', () => {
  it('decodes a cp1251 CSV (Excel/1С export) without mojibake', async () => {
    const buf = cp1251('Артикул;Назва;Ціна;Кількість\nA1;Засіб;123,45;7\n');
    const items = await parseSupplierFeed(buf, 'csv');
    expect(items[0]).toMatchObject({
      sku: 'A1',
      name: 'Засіб',
      purchasePrice: 123.45,
      quantity: 7,
    });
  });

  it('decodes cp1251 CommerceML declared via the XML prolog', async () => {
    const xml =
      `<?xml version="1.0" encoding="windows-1251"?>` +
      `<КоммерческаяИнформация><ПакетПредложений><Предложения>` +
      `<Предложение><Ид>g</Ид><Артикул>ЦЕНА-1</Артикул>` +
      `<Цены><Цена><ЦенаЗаЕдиницу>320,00</ЦенаЗаЕдиницу></Цена></Цены><Количество>2</Количество></Предложение>` +
      `</Предложения></ПакетПредложений></КоммерческаяИнформация>`;
    const items = await parseSupplierFeed(cp1251(xml), 'xml_1c');
    expect(items[0]).toMatchObject({ sku: 'ЦЕНА-1', purchasePrice: 320, quantity: 2 });
  });
});

describe('parsePrice locale handling (via YML)', () => {
  const price = async (raw: string) => {
    const items = await parseSupplierFeed(
      yml(`<offer id="1"><vendorCode>P</vendorCode><price>${raw}</price></offer>`),
      'yml',
    );
    return items[0].purchasePrice;
  };

  it('parses US grouped "1,299.90" without the 1000× bug', async () => {
    expect(await price('1,299.90')).toBe(1299.9);
  });
  it('parses EU grouped "1.299,90"', async () => {
    expect(await price('1.299,90')).toBe(1299.9);
  });
  it('parses multi-group "1,234,567.89"', async () => {
    expect(await price('1,234,567.89')).toBe(1234567.89);
  });
  it('parses UA space-thousands "1 299,90"', async () => {
    expect(await price('1 299,90')).toBe(1299.9);
  });
  it('treats a lone 3-digit comma group "1,234" as thousands', async () => {
    expect(await price('1,234')).toBe(1234);
  });
  it('keeps a 2-digit comma decimal "299,90"', async () => {
    expect(await price('299,90')).toBe(299.9);
  });
});
