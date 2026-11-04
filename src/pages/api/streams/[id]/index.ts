import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import {
  Stream,
  MarathonTemplate,
  User,
  StreamEnrollment,
  TemplateAttachment,
} from '@db/models';
import { NotFound } from '@/lib/errors';
import { withAdmin } from '@/lib/middleware';
import { verifyAccessToken, parseCookies } from '@/lib/auth';
import { ensureStreamStatus } from '@/lib/streamStatus';
import { serializeAttachments } from '@/lib/attachmentUtils';
import { uuidSchema } from '@/lib/validate';
import type { TokenPayload } from '@/types/auth';

function getCurrentUser(req: NextApiRequest): TokenPayload | null {
  const cookies = parseCookies(req);
  const token = cookies.mp_access_token;
  if (!token) return null;
  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const stream = await Stream.findByPk(id as string);
  if (!stream) {
    throw new NotFound('Stream not found');
  }

  stream.status = (await ensureStreamStatus(stream.id)) || stream.status;

  const template = await MarathonTemplate.findByPk(stream.templateId);
  const mentor = template ? await User.findByPk(template.mentorId, { attributes: ['id', 'name', 'email'] }) : null;

  const introAttachments = template
    ? await TemplateAttachment.findAll({
        where: { templateId: template.id, scope: 'intro' },
        order: [['position', 'ASC']],
      })
    : [];

  let isEnrolled = false;
  const currentUser = getCurrentUser(req);
  if (currentUser && currentUser.role === 'participant') {
    const enrollment = await StreamEnrollment.findOne({
      where: { streamId: stream.id, participantId: currentUser.userId },
    });
    isEnrolled = Boolean(enrollment);
  }

  const enrollmentsCount = await StreamEnrollment.count({
    where: { streamId: stream.id },
  });

  return success(res, {
    id: stream.id,
    startDate: stream.startDate,
    status: stream.status,
    createdAt: stream.createdAt,
    enrollmentsCount,
    isEnrolled,
    template: template
      ? {
          id: template.id,
          title: template.title,
          description: template.description,
          durationDays: template.durationDays,
          status: template.status,
        }
      : null,
    intro: template
      ? {
          text: template.introText ?? null,
          attachments: serializeAttachments(introAttachments),
        }
      : null,
    mentor: mentor
      ? { id: mentor.id, name: mentor.name, email: mentor.email }
      : null,
  });
}

async function deleteHandler(req: NextApiRequest, res: NextApiResponse) {
  const id = uuidSchema.parse(req.query.id);

  const stream = await Stream.findByPk(id);
  if (!stream) {
    throw new NotFound('Stream not found');
  }

  await stream.destroy();

  return success(res, { id });
}

export default apiHandler({
  GET: getHandler,
  DELETE: withAdmin(deleteHandler),
});
