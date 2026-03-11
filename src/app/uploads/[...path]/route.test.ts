import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockStat = vi.fn();
const mockReadFile = vi.fn();

vi.mock('fs', () => ({
  promises: {
    stat: (...args: unknown[]) => mockStat(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
  },
}));

import { GET } from './route';

function createRequest(pathSegments: string[]) {
  return new NextRequest(`http://localhost/uploads/${pathSegments.join('/')}`);
}

describe('GET /uploads/[...path]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns file with correct content type for jpg', async () => {
    const buffer = Buffer.from('fake-image-data');
    mockStat.mockResolvedValue({ mtimeMs: 1234567890, size: buffer.length });
    mockReadFile.mockResolvedValue(buffer);

    const res = await GET(
      createRequest(['images', 'test.jpg']),
      { params: Promise.resolve({ path: ['images', 'test.jpg'] }) }
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('Cache-Control')).toContain('public');
    expect(res.headers.get('ETag')).toBeTruthy();
  });

  it('returns correct content type for png', async () => {
    mockStat.mockResolvedValue({ mtimeMs: 100, size: 10 });
    mockReadFile.mockResolvedValue(Buffer.from('png'));

    const res = await GET(
      createRequest(['test.png']),
      { params: Promise.resolve({ path: ['test.png'] }) }
    );

    expect(res.headers.get('Content-Type')).toBe('image/png');
  });

  it('returns correct content type for webp', async () => {
    mockStat.mockResolvedValue({ mtimeMs: 100, size: 10 });
    mockReadFile.mockResolvedValue(Buffer.from('webp'));

    const res = await GET(
      createRequest(['test.webp']),
      { params: Promise.resolve({ path: ['test.webp'] }) }
    );

    expect(res.headers.get('Content-Type')).toBe('image/webp');
  });

  it('returns correct content type for gif', async () => {
    mockStat.mockResolvedValue({ mtimeMs: 100, size: 10 });
    mockReadFile.mockResolvedValue(Buffer.from('gif'));

    const res = await GET(
      createRequest(['test.gif']),
      { params: Promise.resolve({ path: ['test.gif'] }) }
    );

    expect(res.headers.get('Content-Type')).toBe('image/gif');
  });

  it('returns correct content type for svg', async () => {
    mockStat.mockResolvedValue({ mtimeMs: 100, size: 10 });
    mockReadFile.mockResolvedValue(Buffer.from('<svg></svg>'));

    const res = await GET(
      createRequest(['test.svg']),
      { params: Promise.resolve({ path: ['test.svg'] }) }
    );

    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
  });

  it('returns correct content type for pdf', async () => {
    mockStat.mockResolvedValue({ mtimeMs: 100, size: 10 });
    mockReadFile.mockResolvedValue(Buffer.from('pdf'));

    const res = await GET(
      createRequest(['test.pdf']),
      { params: Promise.resolve({ path: ['test.pdf'] }) }
    );

    expect(res.headers.get('Content-Type')).toBe('application/pdf');
  });

  it('returns correct content type for jpeg', async () => {
    mockStat.mockResolvedValue({ mtimeMs: 100, size: 10 });
    mockReadFile.mockResolvedValue(Buffer.from('jpeg'));

    const res = await GET(
      createRequest(['test.jpeg']),
      { params: Promise.resolve({ path: ['test.jpeg'] }) }
    );

    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
  });

  it('returns application/octet-stream for unknown extension', async () => {
    mockStat.mockResolvedValue({ mtimeMs: 100, size: 10 });
    mockReadFile.mockResolvedValue(Buffer.from('data'));

    const res = await GET(
      createRequest(['file.xyz']),
      { params: Promise.resolve({ path: ['file.xyz'] }) }
    );

    expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
  });

  it('returns 404 for path traversal attempt', async () => {
    const res = await GET(
      createRequest(['..', 'etc', 'passwd']),
      { params: Promise.resolve({ path: ['..', 'etc', 'passwd'] }) }
    );

    expect(res.status).toBe(404);
  });

  it('returns 404 when file does not exist', async () => {
    mockStat.mockRejectedValue(new Error('ENOENT'));

    const res = await GET(
      createRequest(['nonexistent.jpg']),
      { params: Promise.resolve({ path: ['nonexistent.jpg'] }) }
    );

    expect(res.status).toBe(404);
  });

  it('joins multiple path segments', async () => {
    mockStat.mockResolvedValue({ mtimeMs: 100, size: 10 });
    mockReadFile.mockResolvedValue(Buffer.from('data'));

    await GET(
      createRequest(['sub', 'dir', 'file.jpg']),
      { params: Promise.resolve({ path: ['sub', 'dir', 'file.jpg'] }) }
    );

    expect(mockStat).toHaveBeenCalledWith(expect.stringContaining('sub/dir/file.jpg'));
  });
});
