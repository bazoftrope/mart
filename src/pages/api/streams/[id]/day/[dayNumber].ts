import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { sequelize } from '@db/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withParticipant } from '@/lib/middleware';
import { BadRequest, Forbidden, NotFound } from '@/lib/errors';
import { saveReportSchema } from '@/lib/validation';
import { getCurrentDayNumber, isDayAccessible, buildMeasuredAtUtc } from '@/lib/calendar';
import { ensureStreamStatus } from '@/lib/streamStatus';
import { calculateRatingsForStream } from '@/lib/ratingCalculator';
import { calculateTargetCalories, isProfileComplete } from '@/lib/calorieCalculator';
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
import { serializeAttachments } from '@/lib/attachmentUtils';
import type { AuthenticatedRequest } from '@/types/auth';

function parseParams(req: NextApiRequest): { streamId: string; dayNumber: number } {
  const rawId = req.query.id;
  const streamId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!streamId) {
    throw new NotFound('Stream not found');
  }

  const rawDay = req.query.dayNumber;
  const dayStr = Array.isArray(rawDay) ? rawDay[0] : rawDay;
  if (!dayStr || !/^\d+$/.test(dayStr)) {
    throw new BadRequest('Invalid day number');
  }
  const dayNumber = parseInt(dayStr, 10);

  return { streamId, dayNumber };
}

async function loadParticipantContext(userId: string, streamId: string) {
  const [user, stream, enrollment] = await Promise.all([
    User.findByPk(userId, {
      attributes: ['id', 'timezone', 'sex', 'heightCm', 'weightKg', 'age'],
    }),
    Stream.findByPk(streamId),
    StreamEnrollment.findOne({
      where: { streamId, participantId: userId },
    }),
  ]);

  if (!user) {
    throw new NotFound('User not found');
  }
  if (!stream) {
    throw new NotFound('Stream not found');
  }
  if (!enrollment) {
    throw new Forbidden('You are not enrolled in this stream');
  }

  const profile = {
    sex: user.sex,
    heightCm: user.heightCm,
    weightKg:
      user.weightKg === null || user.weightKg === undefined
        ? null
        : Number(user.weightKg),
    age: user.age,
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

  const template = await MarathonTemplate.findByPk(stream.templateId);
  if (!template) {
    throw new NotFound('Template not found');
  }

  return {
    currentUser: user,
    stream,
    enrollment,
    template,
    targetCalories: enrollment.targetCalories ?? null,
    goal: enrollment.goal ?? null,
    profileCompleted,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as AuthenticatedRequest;
  const { streamId, dayNumber } = parseParams(req);

  const { currentUser, stream, enrollment, template, targetCalories, goal, profileCompleted } =
    await loadParticipantContext(user.userId, streamId);

  if (dayNumber < 1 || dayNumber > template.durationDays) {
    throw new BadRequest(
      `Day number must be between 1 and ${template.durationDays}`
    );
  }

  const currentDayNumber = getCurrentDayNumber(
    stream.startDate,
    currentUser.timezone,
    template.durationDays
  );

  const ensuredStatus = await ensureStreamStatus(stream.id);
  const isFinished = ensuredStatus === 'finished';

  const [day, report, dayAttachments] = await Promise.all([
    TemplateDay.findOne({
      where: { templateId: template.id, dayNumber },
    }),
    DailyReport.findOne({
      where: { enrollmentId: enrollment.id, dayNumber },
    }),
    dayNumber && template.id
      ? TemplateAttachment.findAll({
          where: { templateId: template.id, scope: 'day' },
          order: [
            ['template_day_id', 'ASC'],
            ['position', 'ASC'],
          ],
        })
      : Promise.resolve([]),
  ]);

  const attachmentsByDay = new Map<string, TemplateAttachment[]>();
  for (const attachment of dayAttachments) {
    if (!attachment.templateDayId) continue;
    const list = attachmentsByDay.get(attachment.templateDayId) ?? [];
    list.push(attachment);
    attachmentsByDay.set(attachment.templateDayId, list);
  }

  let lines: Array<{
    id: string;
    productId: string;
    name: string;
    calories: number;
    weightGrams: number;
    lineCalories: number;
  }> = [];
  let pulseReadings: Array<{ id: string; measuredAt: Date; pulse: number | null; systolic: number | null; diastolic: number | null }> = [];

  if (report) {
    const [reportLines, reportPulseReadings] = await Promise.all([
      ReportLine.findAll({
        where: { reportId: report.id },
      }),
      PulseReading.findAll({
        where: { reportId: report.id },
        order: [['measured_at', 'ASC']],
      }),
    ]);

    const productIds = reportLines.map((line) => line.productId);
    const products = productIds.length
      ? await Product.findAll({ where: { id: productIds } })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    lines = reportLines.map((line) => {
      const product = productMap.get(line.productId);
      return {
        id: line.id,
        productId: line.productId,
        name: product?.name || 'Unknown product',
        calories: Number(product?.calories || 0),
        weightGrams: Number(line.weightGrams),
        lineCalories: Number(line.lineCalories),
      };
    });

    pulseReadings = reportPulseReadings.map((p) => ({
      id: p.id,
      measuredAt: p.measuredAt,
      pulse: p.pulse,
      systolic: p.systolic,
      diastolic: p.diastolic,
    }));
  }

  return success(res, {
    streamId: stream.id,
    dayNumber,
    currentDayNumber,
    isEditable: isDayAccessible(dayNumber, currentDayNumber) && !isFinished,
    isFinished,
    isMeasurementDay: day?.isMeasurementDay ?? false,
    isTrainingDay: day?.isTrainingDay ?? false,
    isRestDay: day?.isRestDay ?? false,
    isHealthyEatingDay: day?.isHealthyEatingDay ?? false,
    targetCalories,
    goal,
    profileCompleted,
    stream: {
      template: {
        title: template.title,
      },
    },
    day: day
      ? {
          textContent: day.textContent || null,
          attachments: serializeAttachments(attachmentsByDay.get(day.id) ?? []),
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
  });
}

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as AuthenticatedRequest;
  const { streamId, dayNumber } = parseParams(req);

  const { currentUser, stream, enrollment, template } = await loadParticipantContext(
    user.userId,
    streamId
  );

  if (dayNumber < 1 || dayNumber > template.durationDays) {
    throw new BadRequest(
      `Day number must be between 1 and ${template.durationDays}`
    );
  }

  const ensuredStatus = await ensureStreamStatus(stream.id);
  if (ensuredStatus === 'finished') {
    throw new Forbidden('Марафон завершён, редактировать отчёты нельзя');
  }

  const currentDayNumber = getCurrentDayNumber(
    stream.startDate,
    currentUser.timezone,
    template.durationDays
  );
  if (!isDayAccessible(dayNumber, currentDayNumber)) {
    throw new Forbidden('This day is not yet available');
  }

  const templateDay = await TemplateDay.findOne({
    where: { templateId: template.id, dayNumber },
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

  let totalCalories = 0;
  const lineRecords = lines.map((line) => {
    const product = productMap.get(line.productId);
    if (!product) {
      throw new BadRequest(`Product ${line.productId} not found`);
    }
    const lineCalories = round2(
      (line.weightGrams * Number(product.calories)) / 100
    );
    totalCalories += lineCalories;
    return {
      productId: line.productId,
      weightGrams: line.weightGrams,
      lineCalories,
    };
  });
  totalCalories = round2(totalCalories);

  const transaction = await sequelize.transaction();
  try {
    const [report] = await DailyReport.findOrCreate({
      where: { enrollmentId: enrollment.id, dayNumber },
      defaults: {
        enrollmentId: enrollment.id,
        dayNumber,
        totalCalories,
      },
      transaction,
    });

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

    await ReportLine.bulkCreate(
      lineRecords.map((record) => ({
        ...record,
        reportId: report.id,
      })),
      { transaction }
    );

    // Pulse is now managed via dedicated pulse endpoint. Keep backward-compat:
    // only touch pulse_readings if client explicitly sent pulseReadings.
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
            dayNumber,
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

    const savedLines = lineRecords.map((record) => {
      const product = productMap.get(record.productId)!;
      return {
        productId: record.productId,
        name: product.name,
        calories: Number(product.calories),
        weightGrams: record.weightGrams,
        lineCalories: record.lineCalories,
      };
    });

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
  GET: withParticipant(getHandler),
  POST: withParticipant(postHandler),
});
