import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pdfkit', () => {
  const mockDoc = {
    pipe: vi.fn().mockReturnThis(),
    font: vi.fn().mockReturnThis(),
    fontSize: vi.fn().mockReturnThis(),
    fillColor: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    moveDown: vi.fn().mockReturnThis(),
    addPage: vi.fn().mockReturnThis(),
    end: vi.fn(),
    y: 100,
    on: vi.fn(),
  };
  return { default: vi.fn(function () { return mockDoc; }) };
});

vi.mock('fs', () => ({
  createWriteStream: vi.fn(() => ({
    on: vi.fn((event: string, cb: () => void) => {
      if (event === 'finish') setTimeout(cb, 0);
    }),
  })),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(() => true),
}));

vi.mock('@/config/env', () => ({
  env: { UPLOAD_DIR: '/tmp/test-uploads' },
}));

vi.mock('@/lib/pdf-theme', () => ({
  BRAND: { text: '#000', textSecondary: '#666', primary: '#0066cc' },
  PAGE: { margin: 40, contentWidth: 515 },
  setupDoc: vi.fn(),
  drawHeader: vi.fn(),
  drawDocTitle: vi.fn(),
  drawSectionTitle: vi.fn(),
  drawFooter: vi.fn(),
  getCompanyInfo: vi.fn().mockResolvedValue({
    name: 'Test Co', email: 'test@co.com', phone: '+380991234567', website: 'https://test.co',
  }),
}));

import { generateUserManual } from './user-manual-pdf';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateUserManual', () => {
  it('should generate a user manual PDF and return public URL', async () => {
    const url = await generateUserManual();
    expect(url).toMatch(/^\/uploads\/docs\/user-manual_\d+\.pdf$/);
  });

  it('should create docs directory if not exists', async () => {
    const { existsSync, mkdirSync } = await import('fs');
    vi.mocked(existsSync).mockReturnValue(false);

    await generateUserManual();

    expect(mkdirSync).toHaveBeenCalledWith(expect.stringContaining('docs'), { recursive: true });
  });

  it('should call drawHeader and drawDocTitle for title page', async () => {
    const { drawHeader, drawDocTitle } = await import('@/lib/pdf-theme');

    await generateUserManual();

    expect(drawHeader).toHaveBeenCalled();
    expect(drawDocTitle).toHaveBeenCalledWith(
      expect.anything(),
      'Інструкція користувача',
      'Керівництво для менеджера адмін-панелі',
      expect.any(String),
    );
  });

  it('should render all 15 sections', async () => {
    const { drawSectionTitle } = await import('@/lib/pdf-theme');

    await generateUserManual();

    // Table of contents page + 15 section pages
    expect(vi.mocked(drawSectionTitle).mock.calls.length).toBeGreaterThanOrEqual(15);
  });

  it('should include contact information on the last page', async () => {
    const PDFDocument = (await import('pdfkit')).default;

    await generateUserManual();

    // The mock constructor returns the same mockDoc each time
    const mockDoc = new (PDFDocument as any)();
    const textCalls = vi.mocked(mockDoc.text).mock.calls.map((c: unknown[]) => String(c[0]));
    expect(textCalls.some((t: string) => t.includes('test@co.com'))).toBe(true);
    expect(textCalls.some((t: string) => t.includes('+380991234567'))).toBe(true);
    expect(textCalls.some((t: string) => t.includes('https://test.co'))).toBe(true);
  });

  it('should call drawFooter for each section', async () => {
    const { drawFooter } = await import('@/lib/pdf-theme');

    await generateUserManual();

    // drawFooter called for title page, TOC page, each of the 15 sections, and final page
    expect(vi.mocked(drawFooter).mock.calls.length).toBeGreaterThanOrEqual(17);
  });

  it('should handle company info without optional fields', async () => {
    const { getCompanyInfo } = await import('@/lib/pdf-theme');
    vi.mocked(getCompanyInfo).mockResolvedValue({
      name: 'Minimal Co', email: null, phone: null, website: null,
    } as never);

    const url = await generateUserManual();
    expect(url).toBeTruthy();
  });
});
