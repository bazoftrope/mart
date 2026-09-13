import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAuth } from '@/lib/middleware';
import { BadRequest } from '@/lib/errors';
import {
  MAX_FILE_SIZE_BYTES,
  ALLOWED_FILE_MIME,
  parseMultipart,
  fileExtensionFromMimeOrFilename,
  safeFilename,
  getContentUploadRoot,
  validateUploadedFile,
} from '@/lib/fileUpload';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// Загрузка PDF для рецептов/тренировок (content_attachments, kind=file)
// Доступно любой авторизованной роли, без привязки к шаблону.
async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const body = await readRawBody(req);
  const contentType = req.headers['content-type'];
  const parsed = await parseMultipart(body, contentType);

  if (parsed.files.length === 0) {
    throw new BadRequest('PDF-файл не передан');
  }

  const root = getContentUploadRoot();
  const dir = path.join(root, 'content');
  fs.mkdirSync(dir, { recursive: true });

  const files = parsed.files.map((file) => {
    validateUploadedFile(file, {
      maxBytes: MAX_FILE_SIZE_BYTES,
      allowedMime: ALLOWED_FILE_MIME,
      label: 'PDF',
    });

    const ext = fileExtensionFromMimeOrFilename(file.contentType, file.filename);
    if (!ext) {
      throw new BadRequest('Неподдерживаемый тип файла (разрешён только PDF)');
    }

    const filename = safeFilename(ext);
    fs.writeFileSync(path.join(dir, filename), file.data);

    return {
      url: `/api/uploads/file/content/${filename}`,
      fileName: file.filename,
      mimeType: file.contentType,
      sizeBytes: file.data.length,
    };
  });

  return success(res, { files }, 201);
}

export default apiHandler({
  POST: withAuth(postHandler),
});
