import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAdmin } from '@/lib/middleware';
import { MarathonTemplate } from '@db/models/MarathonTemplate';
import { TemplateDay } from '@db/models/TemplateDay';
import { TemplateAttachment } from '@db/models/TemplateAttachment';
import { User } from '@db/models/User';
import { toPublicUser } from '@/lib/auth';
import { NotFound } from '@/lib/errors';
import { serializeAttachments } from '@/lib/attachmentUtils';

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const templateId = Array.isArray(id) ? id[0] : id;

  if (!templateId) {
    throw new NotFound('Template not found');
  }

  const template = await MarathonTemplate.findOne({
    where: { id: templateId, status: 'pending_review' },
  });

  if (!template) {
    throw new NotFound('Template not found');
  }

  const [mentor, days, introAttachments] = await Promise.all([
    User.findByPk(template.mentorId),
    TemplateDay.findAll({
      where: { templateId: template.id },
      order: [['day_number', 'ASC']],
    }),
    TemplateAttachment.findAll({
      where: { templateId: template.id, scope: 'intro' },
      order: [['position', 'ASC']],
    }),
  ]);

  const dayIds = days.map((day) => day.id);
  const dayAttachments = dayIds.length
    ? await TemplateAttachment.findAll({
        where: { templateId: template.id, scope: 'day', templateDayId: dayIds },
        order: [
          ['template_day_id', 'ASC'],
          ['position', 'ASC'],
        ],
      })
    : [];

  const attachmentsByDay = new Map<string, TemplateAttachment[]>();
  for (const attachment of dayAttachments) {
    if (!attachment.templateDayId) continue;
    const list = attachmentsByDay.get(attachment.templateDayId) ?? [];
    list.push(attachment);
    attachmentsByDay.set(attachment.templateDayId, list);
  }

  const data = {
    id: template.id,
    title: template.title,
    description: template.description,
    durationDays: template.durationDays,
    introText: template.introText ?? null,
    status: template.status,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    mentor: mentor ? toPublicUser(mentor) : null,
    introAttachments: serializeAttachments(introAttachments),
    days: days.map((day) => ({
      id: day.id,
      dayNumber: day.dayNumber,
      textContent: day.textContent,
      isMeasurementDay: day.isMeasurementDay,
      isTrainingDay: day.isTrainingDay,
      isRestDay: day.isRestDay,
      isHealthyEatingDay: day.isHealthyEatingDay,
      attachments: serializeAttachments(attachmentsByDay.get(day.id) ?? []),
    })),
  };

  return success(res, data);
}

export default apiHandler({ GET: withAdmin(getHandler) });
