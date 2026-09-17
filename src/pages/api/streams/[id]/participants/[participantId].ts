import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withMentor } from '@/lib/middleware';
import { Forbidden, NotFound } from '@/lib/errors';
import {
  Stream,
  MarathonTemplate,
  StreamEnrollment,
  StreamRating,
  DailyReport,
  ReportLine,
  PulseReading,
  Product,
  User,
} from '@db/models';
import { serializeReportLine } from '@/lib/reportLineUtils';
import type { AuthenticatedRequest } from '@/types/auth';

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as AuthenticatedRequest;

  const streamId = single(req.query.id);
  const participantId = single(req.query.participantId);
  if (!streamId) {
    throw new NotFound('Stream not found');
  }
  if (!participantId) {
    throw new NotFound('Participant not found');
  }

  const stream = await Stream.findByPk(streamId);
  if (!stream) {
    throw new NotFound('Stream not found');
  }

  const template = await MarathonTemplate.findByPk(stream.templateId);
  if (!template) {
    throw new NotFound('Template not found');
  }
  if (template.mentorId !== user.userId) {
    throw new Forbidden('You are not the mentor of this stream');
  }

  const enrollment = await StreamEnrollment.findOne({
    where: { streamId, participantId },
  });
  if (!enrollment) {
    throw new NotFound('Participant is not enrolled in this stream');
  }

  const participant = await User.findByPk(participantId, {
    attributes: ['id', 'name', 'email'],
  });
  if (!participant) {
    throw new NotFound('Participant not found');
  }

  const reports = await DailyReport.findAll({
    where: { enrollmentId: enrollment.id },
    order: [['dayNumber', 'ASC']],
  });

  const reportIds = reports.map((r) => r.id);

  const [reportLines, pulseReadings, rating] = await Promise.all([
    reportIds.length
      ? ReportLine.findAll({ where: { reportId: reportIds } })
      : [],
    reportIds.length
      ? PulseReading.findAll({
          where: { reportId: reportIds },
          order: [['measured_at', 'ASC']],
        })
      : [],
    StreamRating.findOne({ where: { streamId, participantId } }),
  ]);

  const productIds = reportLines.map((line) => line.productId);
  const products = productIds.length
    ? await Product.findAll({ where: { id: productIds } })
    : [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  const linesByReport = new Map<string, ReturnType<typeof serializeReportLine>[]>();
  for (const line of reportLines) {
    const list = linesByReport.get(line.reportId) || [];
    list.push(serializeReportLine(line, productMap.get(line.productId)));
    linesByReport.set(line.reportId, list);
  }

  const readingsByReport = new Map<string, Array<unknown>>();
  for (const reading of pulseReadings) {
    const item = {
      id: reading.id,
      measuredAt: reading.measuredAt,
      pulse: reading.pulse,
      systolic: reading.systolic,
      diastolic: reading.diastolic,
    };
    const list = readingsByReport.get(reading.reportId) || [];
    list.push(item);
    readingsByReport.set(reading.reportId, list);
  }

  return success(res, {
    streamId: stream.id,
    participant: {
      id: participant.id,
      name: participant.name,
      email: participant.email,
    },
    stream: {
      status: stream.status,
      startDate: stream.startDate,
      template: {
        title: template.title,
        durationDays: template.durationDays,
      },
    },
    rating: rating
      ? {
          rank: rating.rank ?? null,
          weightLossPercent: Number(rating.weightLossPercent),
          entryWeight:
            rating.entryWeight !== null ? Number(rating.entryWeight) : null,
          currentWeight:
            rating.currentWeight !== null ? Number(rating.currentWeight) : null,
        }
      : null,
    reports: reports.map((report) => ({
      id: report.id,
      dayNumber: report.dayNumber,
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
      lines: linesByReport.get(report.id) || [],
      pulseReadings: readingsByReport.get(report.id) || [],
    })),
  });
}

export default apiHandler({
  GET: withMentor(getHandler),
});
