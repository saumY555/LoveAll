import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * GET /api/faces/[filename]
 * Serves cached face thumbnail WebP images
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Sanitize filename to prevent directory traversal
  const cleanFilename = path.basename(filename);
  const filePath = path.resolve(process.cwd(), 'storage', 'faces', cleanFilename);

  try {
    const data = await fs.readFile(filePath);

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return new NextResponse('Face thumbnail not found', { status: 404 });
    }
    return new NextResponse('Failed to load face thumbnail', { status: 500 });
  }
}
