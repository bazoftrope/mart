import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { sequelize } from '@db/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withParticipant } from '@/lib/middleware';
import { BadRequest, Forbidden, NotFound } from '@/lib/errors';
import { savePulseSchema } from '@/lib/validation';
import { buildMeasuredAtUtc, getCurrentDayNumber, isDayAccessible } from '@/lib/calendar';
import { ensureStreamStatus } from '@/lib/streamStatus';
import {
  Stream,
  MarathonTemplate,
  StreamEnrollment,
  DailyReport,
  PulseReading,
  User,
} from '@db/models';
import type { AuthenticatedRequest } from '@/types/auth';

function parseParams(req: NextApiRequest): { streamId: string; dayNumber: number } {
  const rawId = req.query.id;
  const streamId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!streamId) throw new NotFound('Stream not found');
  const rawDay = req.query.dayNumber;
  const dayStr = Array.isArray(rawDay) ? rawDay[0] : rawDay;
  if (!dayStr || !/^\d+$/.test(dayStr)) throw new BadRequest('Invalid day number');
  return { streamId, dayNumber: parseInt(dayStr, 10) };
}

async function loadContext(userId: string, streamId: string) {
  const [user, stream, enrollment] = await Promise.all([
    User.findByPk(userId, { attributes: ['id', 'timezone'] }),
    Stream.findByPk(streamId),
    StreamEnrollment.findOne({ where: { streamId, participantId: userId } }),
  ]);
  if (!user) throw new NotFound('User not found');
  if (!stream) throw new NotFound('Stream not found');
  if (!enrollment) throw new Forbidden('You are not enrolled in this stream');
  const template = await MarathonTemplate.findByPk(stream.templateId);
  if (!template) throw new NotFound('Template not found');
  return { user, stream, enrollment, template };
}

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as AuthenticatedRequest;
  const { streamId, dayNumber } = parseParams(req);
  const { template } = await loadContext(user.userId, streamId);

  if (dayNumber < 1 || dayNumber > template.durationDays) {
    throw new BadRequest(`Day number must be between 1 and ${template.durationDays}`);
  }

  const enrollment = await StreamEnrollment.findOne({
    where: { streamId, participantId: user.userId },
  });
  if (!enrollment) throw new Forbidden('You are not enrolled');

  const report = await DailyReport.findOne({
    where: { enrollmentId: enrollment.id, dayNumber },
  });

  let pulseReadings: Array<{
    id: string;
    measuredAt: Date;
    pulse: number | null;
    systolic: number | null;
    diastolic: number | null;
  }> = [];
  if (report) {
    const rows = await PulseReading.findAll({
      where: { reportId: report.id },
      order: [['measured_at', 'ASC']],
    });
    pulseReadings = rows.map((p) => ({
      id: p.id,
      measuredAt: p.measuredAt,
      pulse: p.pulse,
      systolic: p.systolic,
      diastolic: p.diastolic,
    }));
  }

  return success(res, { pulseReadings });
}

async function putHandler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as AuthenticatedRequest;
  const { streamId, dayNumber } = parseParams(req);
  const { user: currentUser, stream, enrollment, template } = await loadContext(user.userId, streamId);

  if (dayNumber < 1 || dayNumber > template.durationDays) {
    throw new BadRequest(`Day number must be between 1 and ${template.durationDays}`);
  }

  const ensuredStatus = await ensureStreamStatus(stream.id);
  if (ensuredStatus === 'finished') {
    throw new Forbidden('Марафон завершён, редактировать замеры нельзя');
  }

  const currentDayNumber = getCurrentDayNumber(
    stream.startDate,
    currentUser.timezone,
    template.durationDays
  );
  if (!isDayAccessible(dayNumber, currentDayNumber)) {
    throw new Forbidden('This day is not yet available');
  }

  const body = savePulseSchema.parse(req.body);
  const pulseReadings = body.pulseReadings ?? [];

  const transaction = await sequelize.transaction();
  try {
    let report = await DailyReport.findOne({
      where: { enrollmentId: enrollment.id, dayNumber },
      transaction,
    });

    if (!report) {
      report = await DailyReport.create(
        {
          enrollmentId: enrollment.id,
          dayNumber,
          totalCalories: 0,
          waterLiters: null,
          steps: null,
          sleepHours: null,
          activityMinutes: null,
          trainingDone: null,
          weightKg: null,
          chestCm: null,
          waistCm: null,
          hipCm: null,
          legCm: null,
        },
        { transaction }
      );
    }

    await PulseReading.destroy({ where: { reportId: report.id }, transaction });

    const pulseRecords = pulseReadings.map((reading) => ({
      reportId: report.id,
      measuredAt: buildMeasuredAtUtc(stream.startDate, dayNumber, reading.measuredAt, currentUser.timezone),
      pulse: reading.pulse ?? null,
      systolic: reading.systolic ?? null,
      diastolic: reading.diastolic ?? null,
    }));

    const created = pulseRecords.length ? await PulseReading.bulkCreate(pulseRecords, { transaction }) : [];

    await transaction.commit();

    created.sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime());

    // touch report updatedAt so days cache reflects change
    await report.update({ updatedAt: new Date() });

    return success(res, {
      pulseReadings: created.map((p) => ({
        id: p.id,
        measuredAt: p.measuredAt,
        pulse: p.pulse,
        systolic: p.systolic,
        diastolic: p.diastolic,
      })),
      reportId: report.id,
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export default apiHandler({
  GET: withParticipant(getHandler),
  PUT: withParticipant(putHandler),
});
