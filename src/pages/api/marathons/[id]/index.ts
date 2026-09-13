import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withMentor } from '@/lib/middleware';
import { MarathonTemplate } from '@db/models/MarathonTemplate';
import { TemplateDay } from '@db/models/TemplateDay';
import { TemplateAttachment } from '@db/models/TemplateAttachment';
import { marathonTemplateSchema } from '@/lib/validate';
import { NotFound, Forbidden, BadRequest } from '@/lib/errors';
import { sequelize } from '@db/db';
import { serializeAttachments, sanitizeTemplateText } from '@/lib/attachmentUtils';
import { canEditMarathonTemplate } from '@/lib/templateStatus';
import type { AuthenticatedRequest } from '@/types/auth';

function getTemplateId(req: NextApiRequest): string {
  const id = req.query.id;
  const templateId = Array.isArray(id) ? id[0] : id;
  if (!templateId) {
    throw new NotFound('Template not found');
  }
  return templateId;
}

async function loadOwnedTemplate(req: NextApiRequest) {
  const user = (req as AuthenticatedRequest).user;
  const templateId = getTemplateId(req);

  const template = await MarathonTemplate.findByPk(templateId);
  if (!template) {
    throw new NotFound('Template not found');
  }

  if (template.mentorId !== user.userId) {
    throw new Forbidden('You do not own this template');
  }

  return template;
}

function serializeTemplate(template: MarathonTemplate, extra: Record<string, unknown> = {}) {
  return {
    id: template.id,
    title: template.title,
    description: template.description,
    durationDays: template.durationDays,
    introText: template.introText ?? null,
    status: template.status,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    ...extra,
  };
}

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const template = await loadOwnedTemplate(req);

  const [days, introAttachments] = await Promise.all([
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

  return success(
    res,
    serializeTemplate(template, {
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
    })
  );
}

async function putHandler(req: NextApiRequest, res: NextApiResponse) {
  const template = await loadOwnedTemplate(req);

  if (!canEditMarathonTemplate(template.status)) {
    throw new BadRequest('Only draft or approved templates can be edited');
  }

  const parsed = marathonTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const {
    title,
    description,
    durationDays,
    introText,
    introAttachments,
  } = parsed.data;

  const updatedTemplate = await sequelize.transaction(async (transaction) => {
    template.title = title;
    template.description = description;
    template.durationDays = durationDays;

    // Предстартовые материалы обновляются только когда страница intro явно
    // передаёт introText/introAttachments; основная форма шаблона их не стирает.
    if (introText !== undefined) {
      template.introText = sanitizeTemplateText(introText) ?? null;
    }
    await template.save({ transaction });

    if (introAttachments !== undefined) {
      await TemplateAttachment.destroy({
        where: { templateId: template.id, scope: 'intro' },
        transaction,
      });

      if (introAttachments.length) {
        return TemplateAttachment.bulkCreate(
          introAttachments.map((attachment, index) => ({
            templateId: template.id,
            templateDayId: null,
            scope: 'intro',
            kind: attachment.kind,
            url: attachment.url,
            fileName: attachment.fileName ?? null,
            mimeType: attachment.mimeType ?? null,
            sizeBytes: attachment.sizeBytes ?? null,
            position: attachment.position ?? index,
            pairId: attachment.pairId ?? null,
            description: attachment.description ? String(attachment.description).slice(0, 5000) : null,
          })),
          { transaction }
        ).then(() => template);
      }
    }

    return template;
  });

  const introAttachmentsSaved = await TemplateAttachment.findAll({
    where: { templateId: template.id, scope: 'intro' },
    order: [['position', 'ASC']],
  });

  return success(
    res,
    serializeTemplate(updatedTemplate, {
      introAttachments: serializeAttachments(introAttachmentsSaved),
    })
  );
}

async function deleteHandler(req: NextApiRequest, res: NextApiResponse) {
  const template = await loadOwnedTemplate(req);

  if (template.status !== 'draft') {
    throw new BadRequest('Only draft templates can be deleted');
  }

  await template.destroy();

  return success(res, { id: template.id, deleted: true });
}

export default apiHandler({
  GET: withMentor(getHandler),
  PUT: withMentor(putHandler),
  DELETE: withMentor(deleteHandler),
});
