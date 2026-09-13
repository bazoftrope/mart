import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withParticipant } from '@/lib/middleware';
import { Forbidden, NotFound } from '@/lib/errors';
import { Stream, MarathonTemplate, StreamEnrollment, DailyReport, PulseReading, User } from '@db/models';
import type { AuthenticatedRequest } from '@/types/auth';

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as AuthenticatedRequest;
  const rawId = req.query.id;
  const streamId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!streamId) throw new NotFound('Stream not found');

  const [currentUser, stream, enrollment] = await Promise.all([
    User.findByPk(user.userId, { attributes: ['id', 'timezone'] }),
    Stream.findByPk(streamId),
    StreamEnrollment.findOne({ where: { streamId, participantId: user.userId } }),
  ]);
  if (!currentUser) throw new NotFound('User not found');
  if (!stream) throw new NotFound('Stream not found');
  if (!enrollment) throw new Forbidden('You are not enrolled in this stream');

  const template = await MarathonTemplate.findByPk(stream.templateId);
  if (!template) throw new NotFound('Template not found');

  const reports = await DailyReport.findAll({
    where: { enrollmentId: enrollment.id },
    order: [['dayNumber', 'ASC']],
  });
  const reportIds = reports.map((r) => r.id);
  const reportMap = new Map(reports.map((r) => [r.id, r]));

  const pulses = reportIds.length
    ? await PulseReading.findAll({ where: { reportId: reportIds }, order: [['measured_at', 'ASC']] })
    : [];

  const byDay: Record<number, { dayNumber: number; pulseReadings: typeof pulses }> = {};
  // init empty days
  for (let d = 1; d <= template.durationDays; d++) {
    byDay[d] = { dayNumber: d, pulseReadings: [] as unknown as typeof pulses };
  }
  for (const p of pulses) {
    const r = reportMap.get(p.reportId);
    if (!r) continue;
    const day = r.dayNumber;
    if (!byDay[day]) byDay[day] = { dayNumber: day, pulseReadings: [] as unknown as typeof pulses };
    (byDay[day].pulseReadings as unknown as typeof pulses).push(p);
  }

  const history = Object.values(byDay)
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((entry) => ({
      dayNumber: entry.dayNumber,
      pulseReadings: (entry.pulseReadings as unknown as PulseReading[]).map((p) => ({
        id: p.id,
        measuredAt: p.measuredAt,
        pulse: p.pulse,
        systolic: p.systolic,
        diastolic: p.diastolic,
      })),
    }));

  // flat stats
  const allReadings = pulses.map((p) => ({
    id: p.id,
    measuredAt: p.measuredAt,
    pulse: p.pulse,
    systolic: p.systolic,
    diastolic: p.diastolic,
    dayNumber: reportMap.get(p.reportId)?.dayNumber ?? null,
  }));

  const pulsesOnly = allReadings.map((r) => r.pulse).filter((v): v is number => typeof v === 'number' && v !== null);
  const stats =
    allReadings.length === 0
      ? null
      : {
          count: allReadings.length,
          avgPulse: pulsesOnly.length ? Math.round(pulsesOnly.reduce((s, v) => s + v, 0) / pulsesOnly.length) : null,
          minPulse: pulsesOnly.length ? Math.min(...pulsesOnly) : null,
          maxPulse: pulsesOnly.length ? Math.max(...pulsesOnly) : null,
          avgSystolic:
            allReadings.filter((r) => r.systolic !== null).length > 0
              ? Math.round(
                  allReadings.filter((r) => r.systolic !== null).reduce((s, r) => s + (r.systolic as number), 0) /
                    allReadings.filter((r) => r.systolic !== null).length
                )
              : null,
          avgDiastolic:
            allReadings.filter((r) => r.diastolic !== null).length > 0
              ? Math.round(
                  allReadings.filter((r) => r.diastolic !== null).reduce((s, r) => s + (r.diastolic as number), 0) /
                    allReadings.filter((r) => r.diastolic !== null).length
                )
              : null,
        };

  return success(res, { history, stats, durationDays: template.durationDays });
}

export default apiHandler({ GET: withParticipant(getHandler) });
