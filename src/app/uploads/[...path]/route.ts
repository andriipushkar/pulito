import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  // SVG removed — XSS vector via embedded JavaScript
  '.pdf': 'application/pdf',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const relativePath = segments.join('/');

  // Prevent path traversal
  if (relativePath.includes('..')) {
    return new NextResponse('Not found', { status: 404 });
  }

  const uploadDir = path.join(process.cwd(), 'uploads');
  const filePath = path.join(uploadDir, relativePath);

  // Ensure file is within uploads directory
  if (!filePath.startsWith(uploadDir)) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    // Resolve symlinks before reading — a symlink planted inside uploads
    // (via a vulnerable admin tool or shell access) could otherwise escape
    // the directory: the path-prefix check above operates on the *syntactic*
    // join, not on the resolved physical path.
    const realPath = await fs.realpath(filePath);
    const realUploadDir = await fs.realpath(uploadDir);
    if (!realPath.startsWith(realUploadDir + path.sep) && realPath !== realUploadDir) {
      return new NextResponse('Not found', { status: 404 });
    }
    const stat = await fs.stat(realPath);
    const buffer = await fs.readFile(realPath);
    const ext = path.extname(realPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const etag = `"${stat.mtimeMs.toString(36)}-${stat.size.toString(36)}"`;

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
    };

    // Force download for potentially dangerous file types
    if (ext === '.svg' || ext === '.html' || ext === '.htm') {
      headers['Content-Disposition'] = `attachment; filename="${path.basename(realPath)}"`;
      headers['Content-Type'] = 'application/octet-stream';
    }

    return new NextResponse(buffer, { headers });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
