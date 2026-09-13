import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withParticipant } from '@/lib/middleware';
import { Forbidden, NotFound } from '@/lib/errors';
import { getCurrentDayNumber } from '@/lib/calendar';
import { ensureStreamStatus } from '@/lib/streamStatus';
import {
  Stream,
  MarathonTemplate,
  TemplateDay,
  StreamEnrollment,
  DailyReport,
  ReportLine,
  StreamRating,
  User,
} from '@db/models';
import type { AuthenticatedRequest } from '@/types/auth';

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as AuthenticatedRequest;

  const rawId = req.query.id;
  const streamId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!streamId) {
    throw new NotFound('Stream not found');
  }

  const [currentUser, stream, enrollment] = await Promise.all([
    User.findByPk(user.userId, { attributes: ['id', 'timezone'] }),
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

  const template = await MarathonTemplate.findByPk(stream.templateId);
  if (!template) {
    throw new NotFound('Template not found');
  }

  stream.status = (await ensureStreamStatus(stream.id)) || stream.status;

  const currentDayNumber = getCurrentDayNumber(
    stream.startDate,
    currentUser.timezone,
    template.durationDays
  );

  const rawReports = await DailyReport.findAll({
    where: { enrollmentId: enrollment.id },
    attributes: [
      'id',
      'dayNumber',
      'totalCalories',
      'weightKg',
      'waterLiters',
      'steps',
      'sleepHours',
      'activityMinutes',
      'trainingDone',
      'chestCm',
      'waistCm',
      'hipCm',
      'legCm',
      'filledAt',
    ],
    order: [['dayNumber', 'ASC']],
    raw: true,
  });

  // exclude pulse-only stubs (no calories/metrics/lines) from calendar progress
  const reportIdsForLines = rawReports.map((r) => (r as unknown as { id: string }).id);
  const lineRowsCal = reportIdsForLines.length
    ? await ReportLine.findAll({
        where: { reportId: reportIdsForLines } as never,
        attributes: ['reportId'],
        raw: true,
      })
    : [];
  const lineSetCal = new Set((lineRowsCal as unknown as Array<{ reportId: string }>).map((r) => r.reportId));
  const reports = rawReports.filter((r) => {
    const row = r as unknown as {
      id: string;
      totalCalories: unknown;
      waterLiters: unknown;
      steps: unknown;
      sleepHours: unknown;
      activityMinutes: unknown;
      trainingDone: unknown;
      weightKg: unknown;
      chestCm: unknown;
      waistCm: unknown;
      hipCm: unknown;
      legCm: unknown;
    };
    if (lineSetCal.has(row.id)) return true;
    if (row.totalCalories !== null && Number(row.totalCalories) > 0) return true;
    if (row.waterLiters !== null && row.waterLiters !== undefined) return true;
    if (row.steps !== null && row.steps !== undefined) return true;
    if (row.sleepHours !== null && row.sleepHours !== undefined) return true;
    if (row.activityMinutes !== null && row.activityMinutes !== undefined) return true;
    if (row.trainingDone !== null && row.trainingDone !== undefined) return true;
    if (row.weightKg !== null && row.weightKg !== undefined && Number(row.weightKg) > 0) return true;
    if (row.chestCm !== null && row.chestCm !== undefined) return true;
    if (row.waistCm !== null && row.waistCm !== undefined) return true;
    if (row.hipCm !== null && row.hipCm !== undefined) return true;
    if (row.legCm !== null && row.legCm !== undefined) return true;
    return false;
  }) as unknown as typeof rawReports;

  const measurementDays = await TemplateDay.findAll({
    where: { templateId: template.id, isMeasurementDay: true },
    attributes: ['dayNumber'],
  });

  const [trainingDays, restDays, healthyEatingDays] = await Promise.all([
    TemplateDay.findAll({
      where: { templateId: template.id, isTrainingDay: true },
      attributes: ['dayNumber'],
    }),
    TemplateDay.findAll({
      where: { templateId: template.id, isRestDay: true },
      attributes: ['dayNumber'],
    }),
    TemplateDay.findAll({
      where: { templateId: template.id, isHealthyEatingDay: true },
      attributes: ['dayNumber'],
    }),
  ]);

  const [myRating, totalParticipants] = await Promise.all([
    StreamRating.findOne({
      where: { streamId: stream.id, participantId: user.userId },
    }),
    StreamRating.count({ where: { streamId: stream.id } }),
  ]);

  return success(res, {
    stream: {
      id: stream.id,
      startDate: stream.startDate,
      status: stream.status,
      template: {
        id: template.id,
        title: template.title,
        description: template.description,
        durationDays: template.durationDays,
      },
    },
    currentDayNumber,
    measurementDays: measurementDays.map((d) => d.dayNumber),
    trainingDays: trainingDays.map((d) => d.dayNumber),
    restDays: restDays.map((d) => d.dayNumber),
    healthyEatingDays: healthyEatingDays.map((d) => d.dayNumber),
    targetCalories: enrollment.targetCalories ?? null,
    goal: enrollment.goal ?? null,
    rating: {
      rank: myRating?.rank ?? null,
      totalParticipants,
      weightLossPercent: myRating ? Number(myRating.weightLossPercent) : 0,
    },
    reports: reports.map((report) => ({
      id: report.id,
      dayNumber: report.dayNumber,
      totalCalories: Number(report.totalCalories),
      weightKg:
        report.weightKg !== null && report.weightKg !== undefined
          ? Number(report.weightKg)
          : null,
      filledAt: report.filledAt,
    })),
  });
}

export default apiHandler({
  GET: withParticipant(getHandler),
});
