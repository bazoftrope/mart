import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withParticipant } from '@/lib/middleware';
import { Forbidden, NotFound } from '@/lib/errors';
import { getCurrentDayNumber, isDayAccessible } from '@/lib/calendar';
import { ensureStreamStatus } from '@/lib/streamStatus';
import {
  Stream,
  MarathonTemplate,
  TemplateDay,
  TemplateAttachment,
  StreamEnrollment,
  DailyReport,
  ReportLine,
  Product,
  PulseReading,
  User,
} from '@db/models';
import type { Goal } from '@db/models/StreamEnrollment';
import { calculateTargetCalories, isProfileComplete } from '@/lib/calorieCalculator';
import { serializeAttachments } from '@/lib/attachmentUtils';
import { serializeReportLine } from '@/lib/reportLineUtils';
import type { AuthenticatedRequest } from '@/types/auth';

type PulseReadingItem = { id: string; measuredAt: Date; pulse: number | null; systolic: number | null; diastolic: number | null };

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as AuthenticatedRequest;

  const rawId = req.query.id;
  const streamId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!streamId) {
    throw new NotFound('Stream not found');
  }

  const [currentUser, stream, enrollment] = await Promise.all([
    User.findByPk(user.userId, {
      attributes: ['id', 'timezone', 'sex', 'heightCm', 'weightKg', 'age'],
    }),
    Stream.findByPk(streamId),
    StreamEnrollment.findOne({
      where: { streamId, participantId: user.userId },
    }),
  ]);

  if (!currentUser) {
    throw new NotFound('User not found');
  }
  if (!stream) {
    throw new NotFound('Stream not found');
  }
  if (!enrollment) {
    throw new Forbidden('You are not enrolled in this stream');
  }

  const profile = {
    sex: currentUser.sex,
    heightCm: currentUser.heightCm,
    weightKg:
      currentUser.weightKg === null || currentUser.weightKg === undefined
        ? null
        : Number(currentUser.weightKg),
    age: currentUser.age,
  };
  const profileCompleted = isProfileComplete(profile);

  // Ленивый backfill для записей, созданных до появления цели/нормы.
  if (
    profileCompleted &&
    (enrollment.targetCalories === null || enrollment.targetCalories === undefined)
  ) {
    enrollment.targetCalories = calculateTargetCalories(
      {
        sex: profile.sex as 'male' | 'female',
        heightCm: profile.heightCm as number,
        weightKg: profile.weightKg as number,
        age: profile.age as number,
      },
      enrollment.goal
    );
    await enrollment.save();
  }

  const targetCalories: number | null = enrollment.targetCalories ?? null;
  const goal: Goal | null = enrollment.goal ?? null;

  const template = await MarathonTemplate.findByPk(stream.templateId);
  if (!template) {
    throw new NotFound('Template not found');
  }

  const currentDayNumber = getCurrentDayNumber(
    stream.startDate,
    currentUser.timezone,
    template.durationDays
  );

  const ensuredStatus = await ensureStreamStatus(stream.id);
  const isFinished = ensuredStatus === 'finished';

  const [templateDays, attachments, reports] = await Promise.all([
    TemplateDay.findAll({
      where: { templateId: template.id },
      order: [['dayNumber', 'ASC']],
    }),
    TemplateAttachment.findAll({
      where: { templateId: template.id, scope: 'day' },
      order: [
        ['template_day_id', 'ASC'],
        ['position', 'ASC'],
      ],
    }),
    DailyReport.findAll({
      where: { enrollmentId: enrollment.id },
      order: [['dayNumber', 'ASC']],
    }),
  ]);

  const templateDayMap = new Map(templateDays.map((d) => [d.dayNumber, d]));
  const reportMap = new Map(reports.map((r) => [r.dayNumber, r]));
  const attachmentsByDay = new Map<string, TemplateAttachment[]>();
  for (const attachment of attachments) {
    if (!attachment.templateDayId) continue;
    const list = attachmentsByDay.get(attachment.templateDayId) ?? [];
    list.push(attachment);
    attachmentsByDay.set(attachment.templateDayId, list);
  }

  const reportIds = reports.map((r) => r.id);
  const [reportLines, reportPulseReadings] = reportIds.length
    ? await Promise.all([
        ReportLine.findAll({ where: { reportId: reportIds } }),
        PulseReading.findAll({
          where: { reportId: reportIds },
          order: [['measured_at', 'ASC']],
        }),
      ])
    : [[], []];

  const productIds = reportLines.map((line) => line.productId);
  const products = productIds.length
    ? await Product.findAll({ where: { id: productIds } })
    : [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  const linesByReport = new Map<string, ReturnType<typeof serializeReportLine>[]>();
  for (const line of reportLines) {
    const list = linesByReport.get(line.reportId) ?? [];
    list.push(serializeReportLine(line, productMap.get(line.productId)));
    linesByReport.set(line.reportId, list);
  }

  const pulseByReport = new Map<string, PulseReadingItem[]>();
  for (const reading of reportPulseReadings) {
    const list = pulseByReport.get(reading.reportId) ?? [];
    list.push({
      id: reading.id,
      measuredAt: reading.measuredAt,
      pulse: reading.pulse,
      systolic: reading.systolic,
      diastolic: reading.diastolic,
    });
    pulseByReport.set(reading.reportId, list);
  }

  const days = Array.from({ length: template.durationDays }, (_, i) => {
    const dayNumber = i + 1;
    const templateDay = templateDayMap.get(dayNumber) ?? null;
    const report = reportMap.get(dayNumber) ?? null;
    const lines = report ? (linesByReport.get(report.id) ?? []) : [];
    const pulseReadings = report ? (pulseByReport.get(report.id) ?? []) : [];

    return {
      streamId: stream.id,
      dayNumber,
      currentDayNumber,
      isEditable: isDayAccessible(dayNumber, currentDayNumber) && !isFinished,
      isFinished,
      isMeasurementDay: templateDay?.isMeasurementDay ?? false,
      isTrainingDay: templateDay?.isTrainingDay ?? false,
      isRestDay: templateDay?.isRestDay ?? false,
      isHealthyEatingDay: templateDay?.isHealthyEatingDay ?? false,
      targetCalories,
      goal,
      profileCompleted,
      stream: {
        template: {
          title: template.title,
        },
      },
      day: templateDay
        ? {
            textContent: templateDay.textContent || null,
            attachments: serializeAttachments(attachmentsByDay.get(templateDay.id) ?? []),
          }
        : null,
      report: report
        ? {
            id: report.id,
            totalCalories: Number(report.totalCalories),
            filledAt: report.filledAt,
            updatedAt: report.updatedAt,
            waterLiters: report.waterLiters,
            steps: report.steps,
            sleepHours: report.sleepHours,
            activityMinutes: report.activityMinutes,
            trainingDone: report.trainingDone,
            weightKg: report.weightKg,
            chestCm: report.chestCm,
            waistCm: report.waistCm,
            hipCm: report.hipCm,
            legCm: report.legCm,
            pulseReadings,
            lines,
          }
        : null,
    };
  });

  return success(res, {
    streamId: stream.id,
    days,
  });
}

export default apiHandler({
  GET: withParticipant(getHandler),
});