import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnd = vi.fn();
const mockPipe = vi.fn();
const mockFont = vi.fn().mockReturnThis();
const mockFontSize = vi.fn().mockReturnThis();
const mockFillColor = vi.fn().mockReturnThis();
const mockText = vi.fn().mockReturnThis();
const mockMoveDown = vi.fn().mockReturnThis();
const mockAddPage = vi.fn().mockReturnThis();

vi.mock('pdfkit', () => ({
  default: vi.fn().mockImplementation(() => ({
    pipe: mockPipe,
    font: mockFont,
    fontSize: mockFontSize,
    fillColor: mockFillColor,
    text: mockText,
    moveDown: mockMoveDown,
    addPage: mockAddPage,
    end: mockEnd,
    y: 100,
  })),
}));

const mockStreamOn = vi.fn();
const mockCreateWriteStream = vi.fn().mockReturnValue({ on: mockStreamOn });

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    createWriteStream: mockCreateWriteStream,
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
  };
});

vi.mock('@/config/env', () => ({
  env: { UPLOAD_DIR: '/tmp/uploads' },
}));

vi.mock('@/lib/pdf-theme', () => ({
  BRAND: { text: '#000', textSecondary: '#666' },
  PAGE: { margin: 40 },
  setupDoc: vi.fn(),
  drawHeader: vi.fn(),
  drawDocTitle: vi.fn(),
  drawTableHeader: vi.fn(),
  drawTableRow: vi.fn(),
  drawTotalBlock: vi.fn(),
  drawFooter: vi.fn(),
  getCompanyInfo: vi.fn().mockResolvedValue({
    name: 'Test Company',
    address: '123 Test St',
    phone: '+380000000000',
  }),
}));

import { generateCommercialProposal } from './commercial-proposal';

beforeEach(() => {
  vi.clearAllMocks();
  // Make stream.on('finish', resolve) fire immediately
  mockStreamOn.mockImplementation((event: string, cb: () => void) => {
    if (event === 'finish') cb();
  });
});

describe('generateCommercialProposal', () => {
  const validOptions = {
    clientName: 'Тест Клієнт',
    clientCompany: 'ТОВ Тест',
    items: [
      { code: 'A1', name: 'Товар 1', quantity: 2, price: 100, total: 200 },
      { code: 'A2', name: 'Товар 2', quantity: 1, price: 300, total: 300 },
    ],
    totalAmount: 500,
    validDays: 7,
    comment: 'Test comment',
  };

  it('should generate PDF and return URL', async () => {
    const url = await generateCommercialProposal(validOptions);

    expect(url).toMatch(/^\/uploads\/proposals\/proposal_\d+\.pdf$/);
    expect(mockPipe).toHaveBeenCalledTimes(1);
    expect(mockEnd).toHaveBeenCalledTimes(1);
    expect(mockCreateWriteStream).toHaveBeenCalledTimes(1);
    const filePath = mockCreateWriteStream.mock.calls[0][0] as string;
    expect(filePath).toContain('/tmp/uploads/proposals/');
  });

  it('should call doc methods for rendering', async () => {
    await generateCommercialProposal(validOptions);

    expect(mockFont).toHaveBeenCalled();
    expect(mockText).toHaveBeenCalled();
  });

  it('should throw when no items provided', async () => {
    await expect(
      generateCommercialProposal({
        clientName: 'Empty',
        items: [],
        totalAmount: 0,
      }),
    ).rejects.toThrow('Немає товарів для комерційної пропозиції');
  });
});
