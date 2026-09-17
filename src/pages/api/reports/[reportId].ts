import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { sequelize } from '@db/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withParticipant } from '@/lib/middleware';
import { Forbidden, NotFound } from '@/lib/errors';
import { saveReportSchema } from '@/lib/validation';
import { buildMeasuredAtUtc } from '@/lib/calendar';
import { ensureStreamStatus } from '@/lib/streamStatus';
import { calculateRatingsForStream } from '@/lib/ratingCalculator';
import {
  buildReportLineRecords,
  serializeReportLine,
} from '@/lib/reportLineUtils';
import {
  DailyReport,
  ReportLine,
  Product,
  PulseReading,
  StreamEnrollment,
  Stream,
  TemplateDay,
  User,
} from '@db/models';
import type { AuthenticatedRequest } from '@/types/auth';

function parseReportId(req: NextApiRequest): string {
  const raw = req.query.reportId;
  const reportId = Array.isArray(raw) ? raw[0] : raw;
  if (!reportId) {
    throw new NotFound('Report not found');
  }
  return reportId;
}

async function putHandler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as AuthenticatedRequest;
  const reportId = parseReportId(req);

  const report = await DailyReport.findByPk(reportId);
  if (!report) {
    throw new NotFound('Report not found');
  }

  const enrollment = await StreamEnrollment.findByPk(report.enrollmentId);
  if (!enrollment || enrollment.participantId !== user.userId) {
    throw new Forbidden('You do not have access to this report');
  }

  const [stream, currentUser] = await Promise.all([
    Stream.findByPk(enrollment.streamId),
    User.findByPk(user.userId, {
      attributes: ['id', 'timezone', 'weightKg'],
    }),
  ]);

  if (!stream) {
    throw new NotFound('Stream not found');
  }
  if (!currentUser) {
    throw new NotFound('User not found');
  }

  const ensuredStatus = await ensureStreamStatus(stream.id);
  if (ensuredStatus === 'finished') {
    throw new Forbidden('Марафон завершён, редактировать отчёты нельзя');
  }

  const templateDay = await TemplateDay.findOne({
    where: { templateId: stream.templateId, dayNumber: report.dayNumber },
  });
  const isMeasurementDay = templateDay?.isMeasurementDay ?? false;

  const body = saveReportSchema.parse(req.body);
  const lines = body.lines ?? [];
  const {
    waterLiters,
    steps,
    sleepHours,
    activityMinutes,
    trainingDone,
    weightKg,
    chestCm,
    waistCm,
    hipCm,
    legCm,
    pulseReadings,
  } = body;

  const productIds = lines.map((line) => line.productId);
  const products = productIds.length
    ? await Product.findAll({ where: { id: productIds } })
    : [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  const { records: lineRecords, totalCalories } = buildReportLineRecords(
    lines,
    productMap
  );

  const transaction = await sequelize.transaction();
  try {
    report.totalCalories = totalCalories;
    report.waterLiters = waterLiters ?? null;
    report.steps = steps ?? null;
    report.sleepHours = sleepHours ?? null;
    report.activityMinutes = activityMinutes ?? null;
    report.trainingDone = trainingDone ?? null;
    report.weightKg = isMeasurementDay ? (weightKg ?? null) : null;
    report.chestCm = isMeasurementDay ? (chestCm ?? null) : null;
    report.waistCm = isMeasurementDay ? (waistCm ?? null) : null;
    report.hipCm = isMeasurementDay ? (hipCm ?? null) : null;
    report.legCm = isMeasurementDay ? (legCm ?? null) : null;
    await report.save({ transaction });

    await ReportLine.destroy({
      where: { reportId: report.id },
      transaction,
    });

    const createdLines = await ReportLine.bulkCreate(
      lineRecords.map((record) => ({
        ...record,
        reportId: report.id,
      })),
      { transaction }
    );

    let createdPulse: PulseReading[] = [];
    const hasPulsePayload = Object.prototype.hasOwnProperty.call(body, 'pulseReadings');
    if (hasPulsePayload) {
      await PulseReading.destroy({
        where: { reportId: report.id },
        transaction,
      });

      const pulseRecords =
        pulseReadings?.map((reading) => ({
          reportId: report.id,
          measuredAt: buildMeasuredAtUtc(
            stream.startDate,
            report.dayNumber,
            reading.measuredAt,
            currentUser.timezone
          ),
          pulse: reading.pulse ?? null,
          systolic: reading.systolic ?? null,
          diastolic: reading.diastolic ?? null,
        })) ?? [];

      createdPulse = pulseRecords.length
        ? await PulseReading.bulkCreate(pulseRecords, { transaction })
        : [];
    } else {
      createdPulse = await PulseReading.findAll({
        where: { reportId: report.id },
        order: [['measured_at', 'ASC']],
        transaction,
      });
    }

    if (isMeasurementDay && weightKg !== undefined && weightKg !== null) {
      currentUser.weightKg = weightKg;
      await currentUser.save({ transaction });
    }

    await transaction.commit();

    await calculateRatingsForStream(stream.id);

    const savedLines = createdLines.map((line) =>
      serializeReportLine(line, productMap.get(line.productId))
    );

    createdPulse.sort(
      (a, b) => a.measuredAt.getTime() - b.measuredAt.getTime()
    );

    return success(res, {
      id: report.id,
      totalCalories,
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
      pulseReadings: createdPulse.map((p) => ({
        id: p.id,
        measuredAt: p.measuredAt,
        pulse: p.pulse,
        systolic: p.systolic,
        diastolic: p.diastolic,
      })),
      lines: savedLines,
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export default apiHandler({
  PUT: withParticipant(putHandler),
});
