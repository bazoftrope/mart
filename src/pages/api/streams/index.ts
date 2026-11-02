import type { NextApiRequest, NextApiResponse } from 'next';
import { Op } from 'sequelize';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withMentor } from '@/lib/middleware';
import { Stream, MarathonTemplate, User, StreamEnrollment } from '@db/models';
import { createStreamSchema } from '@/lib/validate';
import { Forbidden, NotFound } from '@/lib/errors';
import { ensureStreamStatusFor } from '@/lib/streamStatus';
import type { AuthenticatedRequest } from '@/types/auth';

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as AuthenticatedRequest).user;

  const parsed = createStreamSchema.safeParse(req.body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { templateId, startDate } = parsed.data;

  const template = await MarathonTemplate.findByPk(templateId);
  if (!template) {
    throw new NotFound('Template not found');
  }

  if (template.mentorId !== user.userId) {
    throw new Forbidden('You can only create streams from your own templates');
  }

  if (template.status !== 'approved') {
    throw new Forbidden('Only approved templates can be launched');
  }

  const stream = await Stream.create({
    templateId,
    startDate,
    status: 'open',
  });

  return success(res, {
    id: stream.id,
    templateId: stream.templateId,
    startDate: stream.startDate,
    status: stream.status,
    createdAt: stream.createdAt,
  }, 201);
}

async function getHandler(_req: NextApiRequest, res: NextApiResponse) {
  const candidates = await Stream.findAll({
    where: { status: { [Op.ne]: 'finished' } },
    order: [['start_date', 'ASC']],
  });

  const candidateTemplateIds = Array.from(
    new Set(candidates.map((s) => s.templateId))
  );
  const candidateTemplates = candidateTemplateIds.length
    ? await MarathonTemplate.findAll({
        where: { id: candidateTemplateIds },
        attributes: ['id', 'durationDays'],
      })
    : [];
  const candidateTemplateMap = new Map(
    candidateTemplates.map((t) => [t.id, t])
  );

  for (const stream of candidates) {
    const template = candidateTemplateMap.get(stream.templateId);
    stream.status = await ensureStreamStatusFor(
      stream,
      template?.durationDays ?? 0
    );
  }

  const streams = candidates.filter((s) => s.status !== 'finished');

  const streamIds = streams.map((s) => s.id);
  const enrollmentRows = streamIds.length
    ? await StreamEnrollment.findAll({
        attributes: ['streamId'],
        where: { streamId: streamIds },
      })
    : [];
  const enrollmentCounts = enrollmentRows.reduce<Record<string, number>>(
    (acc, enrollment) => {
      acc[enrollment.streamId] = (acc[enrollment.streamId] || 0) + 1;
      return acc;
    },
    {}
  );

  const templateIds = Array.from(new Set(streams.map((s) => s.templateId)));
  const templates = templateIds.length
    ? await MarathonTemplate.findAll({
        where: { id: templateIds },
      })
    : [];
  const templateMap = new Map(templates.map((t) => [t.id, t]));

  const mentorIds = Array.from(new Set(templates.map((t) => t.mentorId)));
  const mentors = mentorIds.length
    ? await User.findAll({
        where: { id: mentorIds },
        attributes: ['id', 'name', 'email'],
      })
    : [];
  const mentorMap = new Map(mentors.map((m) => [m.id, m]));

  const data = streams.map((stream) => {
    const template = templateMap.get(stream.templateId);
    const mentor = template ? mentorMap.get(template.mentorId) : null;

    return {
      id: stream.id,
      startDate: stream.startDate,
      status: stream.status,
      enrollmentsCount: enrollmentCounts[stream.id] || 0,
      template: template
        ? {
            id: template.id,
            title: template.title,
            description: template.description,
            durationDays: template.durationDays,
          }
        : null,
      mentor: mentor
        ? {
            id: mentor.id,
            name: mentor.name,
            email: mentor.email,
          }
        : null,
    };
  });

  return success(res, data);
}

export default apiHandler({
  POST: withMentor(postHandler),
  GET: getHandler,
});
