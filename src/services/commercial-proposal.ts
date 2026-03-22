import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { env } from '@/config/env';
import {
  BRAND, PAGE, setupDoc, drawHeader, drawDocTitle,
  drawTableHeader as drawThemedTableHeader, drawTableRow, drawTotalBlock, drawFooter, getCompanyInfo,
} from '@/lib/pdf-theme';

interface ProposalItem {
  code: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

interface ProposalOptions {
  clientName: string;
  clientCompany?: string;
  items: ProposalItem[];
  totalAmount: number;
  validDays?: number;
  comment?: string;
}

export async function generateCommercialProposal(options: ProposalOptions): Promise<string> {
  const company = await getCompanyInfo();
  const { clientName, clientCompany, items, totalAmount, validDays = 14, comment } = options;

  if (items.length === 0) {
    throw new Error('Немає товарів для комерційної пропозиції');
  }

  const proposalDir = path.join(env.UPLOAD_DIR, 'proposals');
  if (!existsSync(proposalDir)) {
    mkdirSync(proposalDir, { recursive: true });
  }

  const timestamp = Date.now();
  const fileName = `proposal_${timestamp}.pdf`;
  const filePath = path.join(proposalDir, fileName);
  const publicUrl = `/uploads/proposals/${fileName}`;

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  setupDoc(doc);
  doc.font('Regular');

  const stream = createWriteStream(filePath);
  doc.pipe(stream);

  // Header
  drawHeader(doc, company);
  drawDocTitle(
    doc,
    'Комерційна пропозиція',
    clientCompany || clientName,
    new Date().toLocaleDateString('uk-UA'),
  );

  // Client info
  doc.moveDown(1);
  doc.font('Bold').fontSize(10).fillColor(BRAND.text).text('Клієнт:', 40);
  doc.font('Regular').fontSize(10).fillColor(BRAND.textSecondary);
  doc.text(clientName, 100, doc.y - 12);
  if (clientCompany) {
    doc.text(`Компанія: ${clientCompany}`, 40);
  }

  doc.moveDown(1);

  // Table
  const M = PAGE.margin;
  const tableColumns = [
    { label: '№', x: M, width: 30 },
    { label: 'Код', x: M + 35, width: 65 },
    { label: 'Назва', x: M + 105, width: 200 },
    { label: 'К-сть', x: M + 310, width: 45, align: 'right' as const },
    { label: 'Ціна', x: M + 360, width: 65, align: 'right' as const },
    { label: 'Сума', x: M + 430, width: 65, align: 'right' as const },
  ];

  drawThemedTableHeader(doc, tableColumns);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (doc.y > 720) {
      drawFooter(doc, company);
      doc.addPage();
      drawHeader(doc, company);
      drawThemedTableHeader(doc, tableColumns);
    }

    drawTableRow(doc, [
      { value: String(i + 1), x: tableColumns[0].x, width: tableColumns[0].width },
      { value: item.code, x: tableColumns[1].x, width: tableColumns[1].width },
      { value: item.name.slice(0, 45), x: tableColumns[2].x, width: tableColumns[2].width },
      { value: String(item.quantity), x: tableColumns[3].x, width: tableColumns[3].width, align: 'right' },
      { value: item.price.toFixed(2), x: tableColumns[4].x, width: tableColumns[4].width, align: 'right' },
      { value: item.total.toFixed(2), x: tableColumns[5].x, width: tableColumns[5].width, align: 'right' },
    ], i, 16);
  }

  doc.moveDown(1);
  drawTotalBlock(doc, `Загалом: ${totalAmount.toFixed(2)} грн`);

  // Validity
  doc.moveDown(2);
  doc.font('Regular').fontSize(9).fillColor(BRAND.textSecondary);
  const validUntil = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);
  doc.text(`Пропозиція дійсна до: ${validUntil.toLocaleDateString('uk-UA')}`, { align: 'center' });

  if (comment) {
    doc.moveDown(1);
    doc.text(`Примітка: ${comment}`, { align: 'center' });
  }

  drawFooter(doc, company);
  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return publicUrl;
}
