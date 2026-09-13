import type { NextApiRequest, NextApiResponse } from 'next';
import { Transaction } from 'sequelize';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withMentor } from '@/lib/middleware';
import { MarathonTemplate } from '@db/models/MarathonTemplate';
import { TemplateDay } from '@db/models/TemplateDay';
import { TemplateAttachment } from '@db/models/TemplateAttachment';
import { updateTemplateDaysSchema } from '@/lib/validate';
import { NotFound, Forbidden, BadRequest } from '@/lib/errors';
import { sequelize } from '@db/db';
import { serializeAttachments, sanitizeTemplateText } from '@/lib/attachmentUtils';
import { canEditMarathonTemplate } from '@/lib/templateStatus';
import type { AuthenticatedRequest } from '@/types/auth';

async function loadOwnedTemplate(req: NextApiRequest) {
  const user = (req as AuthenticatedRequest).user;

  const id = req.query.id;
  const templateId = Array.isArray(id) ? id[0] : id;
  if (!templateId) {
    throw new NotFound('Template not found');
  }

  const template = await MarathonTemplate.findByPk(templateId);
  if (!template) {
    throw new NotFound('Template not found');
  }

  if (template.mentorId !== user.userId) {
    throw new Forbidden('You do not own this template');
  }

  return template;
}

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const template = await loadOwnedTemplate(req);

  const days = await TemplateDay.findAll({
    where: { templateId: template.id },
    order: [['day_number', 'ASC']],
  });

  const attachments = await TemplateAttachment.findAll({
    where: { templateId: template.id, scope: 'day' },
    order: [
      ['template_day_id', 'ASC'],
      ['position', 'ASC'],
    ],
  });

  const attachmentsByDay = new Map<string, TemplateAttachment[]>();
  for (const attachment of attachments) {
    if (!attachment.templateDayId) continue;
    const list = attachmentsByDay.get(attachment.templateDayId) ?? [];
    list.push(attachment);
    attachmentsByDay.set(attachment.templateDayId, list);
  }

  return success(
    res,
    days.map((day) => ({
      id: day.id,
      dayNumber: day.dayNumber,
      textContent: day.textContent,
      isMeasurementDay: day.isMeasurementDay,
      isTrainingDay: day.isTrainingDay,
      isRestDay: day.isRestDay,
      isHealthyEatingDay: day.isHealthyEatingDay,
      attachments: serializeAttachments(attachmentsByDay.get(day.id) ?? []),
    }))
  );
}

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const template = await loadOwnedTemplate(req);

  if (!canEditMarathonTemplate(template.status)) {
    throw new BadRequest('Only draft or approved templates can be edited');
  }

  const parsed = updateTemplateDaysSchema.safeParse(req.body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { days } = parsed.data;

  const dayNumbers = days.map((day) => day.dayNumber);
  const uniqueDayNumbers = new Set(dayNumbers);
  if (uniqueDayNumbers.size !== dayNumbers.length) {
    throw new BadRequest('Day numbers must be unique');
  }

  if (days.length !== template.durationDays) {
    throw new BadRequest(`Expected ${template.durationDays} days, but received ${days.length}`);
  }

  const result = await sequelize.transaction(async (transaction: Transaction) => {
    await TemplateDay.destroy({
      where: { templateId: template.id },
      transaction,
    });

    const createdDays: TemplateDay[] = [];
    for (const day of days) {
      const created = await TemplateDay.create(
        {
          templateId: template.id,
          dayNumber: day.dayNumber,
          textContent: sanitizeTemplateText(day.textContent) ?? null,
          isMeasurementDay: day.isMeasurementDay,
          isTrainingDay: day.isTrainingDay,
          isRestDay: day.isRestDay,
          isHealthyEatingDay: day.isHealthyEatingDay,
        },
        { transaction }
      );
      createdDays.push(created);
    }

    const attachmentRows: Array<{
      templateId: string;
      templateDayId: string;
      scope: 'day';
      kind: 'audio' | 'video' | 'file' | 'image';
      url: string;
      fileName: string | null;
      mimeType: string | null;
      sizeBytes: number | null;
      position: number;
      pairId: string | null;
      description: string | null;
    }> = [];
    for (let i = 0; i < createdDays.length; i++) {
      const createdDay = createdDays[i];
      const dayInput = days[i];
      const dayAttachments = dayInput.attachments ?? [];

      dayAttachments.forEach((attachment, index) => {
        attachmentRows.push({
          templateId: template.id,
          templateDayId: createdDay.id,
          scope: 'day',
          kind: attachment.kind,
          url: attachment.url,
          fileName: attachment.fileName ?? null,
          mimeType: attachment.mimeType ?? null,
          sizeBytes: attachment.sizeBytes ?? null,
          position: attachment.position ?? index,
          pairId: attachment.pairId ?? null,
          description: attachment.description ? String(attachment.description).slice(0, 5000) : null,
        });
      });
    }

    const createdAttachments =
      attachmentRows.length > 0
        ? await TemplateAttachment.bulkCreate(attachmentRows, { transaction })
        : [];

    const attachmentsByDay = new Map<string, TemplateAttachment[]>();
    for (const attachment of createdAttachments) {
      if (!attachment.templateDayId) continue;
      const list = attachmentsByDay.get(attachment.templateDayId) ?? [];
      list.push(attachment);
      attachmentsByDay.set(attachment.templateDayId, list);
    }

    return createdDays.map((day) => ({
      id: day.id,
      dayNumber: day.dayNumber,
      textContent: day.textContent,
      isMeasurementDay: day.isMeasurementDay,
      isTrainingDay: day.isTrainingDay,
      isRestDay: day.isRestDay,
      isHealthyEatingDay: day.isHealthyEatingDay,
      attachments: serializeAttachments(attachmentsByDay.get(day.id) ?? []),
    }));
  });

  return success(res, result);
}

export default apiHandler({
  GET: withMentor(getHandler),
  POST: withMentor(postHandler),
});
