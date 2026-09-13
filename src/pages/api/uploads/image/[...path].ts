import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler } from '@/lib/apiHandler';
import { NotFound } from '@/lib/errors';
import { resolveUploadPath } from '@/lib/fileUpload';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const parts = req.query.path;
  const pathArray = Array.isArray(parts) ? parts : parts ? [parts] : [];
  if (pathArray.length === 0) {
    throw new NotFound('File not found');
  }

  const full = resolveUploadPath(pathArray);
  if (!full) {
    throw new NotFound('File not found');
  }

  const ext = path.extname(full).toLowerCase();
  const mime = MIME_BY_EXT[ext] || 'application/octet-stream';

  const stat = fs.statSync(full);
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Length', String(stat.size));
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

  const range = req.headers.range as string | undefined;
  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (match) {
      const start = Number.parseInt(match[1], 10);
      const end = match[2] ? Number.parseInt(match[2], 10) : stat.size - 1;
      if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || start >= stat.size || end < start) {
        res.statusCode = 416;
        res.setHeader('Content-Range', `bytes */${stat.size}`);
        res.end();
        return;
      }
      const chunkSize = end - start + 1;
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      res.setHeader('Content-Length', String(chunkSize));
      const stream = fs.createReadStream(full, { start, end });
      stream.pipe(res);
      return;
    }
  }

  const stream = fs.createReadStream(full);
  stream.pipe(res);
}

export default apiHandler({
  GET: getHandler,
});
