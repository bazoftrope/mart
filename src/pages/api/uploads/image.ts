import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAuth } from '@/lib/middleware';
import { MarathonTemplate } from '@db/models/MarathonTemplate';
import { BadRequest, Forbidden, NotFound } from '@/lib/errors';
import type { AuthenticatedRequest } from '@/types/auth';
import {
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_MIME,
  parseMultipart,
  imageExtensionFromMimeOrFilename,
  safeFilename,
  getContentUploadRoot,
  getTemplateUploadDir,
  ensureUploadRoot,
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

// Универсальный загрузчик изображений:
// - с templateId (ментор) → хранит в /<templateId>/, URL /api/uploads/image/<templateId>/<file> (для дней марафона)
// - без templateId (любой auth) → хранит в /content/, URL /api/uploads/image/content/<file> (для рецептов/тренировок)
async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as AuthenticatedRequest).user;
  const body = await readRawBody(req);
  const contentType = req.headers['content-type'];
  const parsed = await parseMultipart(body, contentType);

  if (parsed.files.length === 0) {
    throw new BadRequest('Файл изображения не передан');
  }

  const templateId = parsed.fields.templateId;
  let dir: string;
  let urlBuilder: (filename: string) => string;

  if (templateId) {
    // Менторская загрузка для шаблона — проверяем владение
    const template = await MarathonTemplate.findByPk(templateId);
    if (!template) throw new NotFound('Template not found');
    if (template.mentorId !== user.userId) throw new Forbidden('You do not own this template');
    dir = getTemplateUploadDir(template.id);
    ensureUploadRoot();
    fs.mkdirSync(dir, { recursive: true });
    // Публичный URL: /api/uploads/image/<templateId>/<file>
    urlBuilder = (filename: string) => `/api/uploads/image/${template.id}/${filename}`;
  } else {
    const root = getContentUploadRoot();
    dir = path.join(root, 'content');
    fs.mkdirSync(dir, { recursive: true });
    urlBuilder = (filename: string) => `/api/uploads/image/content/${filename}`;
  }

  const files = parsed.files.map((file) => {
    validateUploadedFile(file, {
      maxBytes: MAX_IMAGE_SIZE_BYTES,
      allowedMime: ALLOWED_IMAGE_MIME,
      label: 'изображения',
    });

    const ext = imageExtensionFromMimeOrFilename(file.contentType, file.filename);
    if (!ext) {
      throw new BadRequest('Неподдерживаемый тип изображения (разрешены jpg, png, webp, gif)');
    }

    const filename = safeFilename(ext);
    fs.writeFileSync(path.join(dir, filename), file.data);

    return {
      url: urlBuilder(filename),
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
