import 'reflect-metadata';
import { Op } from 'sequelize';
import { sequelize } from '@db/db';
import {
  Stream,
  StreamEnrollment,
  DailyReport,
  ReportLine,
  StreamRating,
  MarathonTemplate,
} from '@db/models';
import type { StreamStatus } from '@db/models/Stream';

type EnrollmentStats = {
  enrollment: StreamEnrollment;
  filledDays: number;
  entryWeight: number | null;
  currentWeight: number | null;
  weightLossPercent: number;
};

export async function calculateRatingsForStream(streamId: string): Promise<void> {
  const stream = await Stream.findByPk(streamId);
  if (!stream) {
    throw new Error(`Stream ${streamId} not found`);
  }

  const template = await MarathonTemplate.findByPk(stream.templateId);
  if (!template) {
    throw new Error(`Template for stream ${streamId} not found`);
  }

  const durationDays = template.durationDays;
  if (!durationDays || durationDays <= 0) {
    throw new Error(`Invalid durationDays for stream ${streamId}`);
  }

  const enrollments = await StreamEnrollment.findAll({
    where: { streamId: stream.id },
  });

  const calculatedAt = new Date();
  const stats: EnrollmentStats[] = [];

  for (const enrollment of enrollments) {
    const reports = await DailyReport.findAll({
      where: { enrollmentId: enrollment.id },
      attributes: [
        'id',
        'dayNumber',
        'weightKg',
        'totalCalories',
        'waterLiters',
        'steps',
        'sleepHours',
        'activityMinutes',
        'trainingDone',
        'chestCm',
        'waistCm',
        'hipCm',
        'legCm',
      ],
      order: [['dayNumber', 'ASC']],
      raw: true,
    });

    // pulse-only reports (totalCalories 0 + no metrics + no lines) must not count toward discipline
    const reportIds = reports.map((r) => (r as unknown as { id: string }).id);
    const lineRows = reportIds.length
      ? await ReportLine.findAll({
          where: { reportId: reportIds } as never,
          attributes: ['reportId'],
          raw: true,
        })
      : [];
    const lineSet = new Set((lineRows as unknown as Array<{ reportId: string }>).map((r) => r.reportId));

    const filledReports = reports.filter((r) => {
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
      if (lineSet.has(row.id)) return true;
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
    });
    const filledDays = filledReports.length;
    const weightReports = reports.filter(
      (r) => r.weightKg !== null && r.weightKg !== undefined && Number(r.weightKg) > 0
    );
    const enrollmentEntryWeight =
      enrollment.entryWeightKg !== null &&
      enrollment.entryWeightKg !== undefined &&
      Number(enrollment.entryWeightKg) > 0
        ? Number(enrollment.entryWeightKg)
        : null;
    const entryWeight = enrollmentEntryWeight
      ? enrollmentEntryWeight
      : weightReports.length
        ? Number(weightReports[0].weightKg)
        : null;
    const currentWeight = weightReports.length
      ? Number(weightReports[weightReports.length - 1].weightKg)
      : null;

    let weightLossPercent = 0;
    if (entryWeight && entryWeight > 0 && currentWeight !== null) {
      weightLossPercent = Number(
        (((entryWeight - currentWeight) / entryWeight) * 100).toFixed(2)
      );
    }

    stats.push({ enrollment, filledDays, entryWeight, currentWeight, weightLossPercent });
  }

  stats.sort((a, b) => b.weightLossPercent - a.weightLossPercent);

  const transaction = await sequelize.transaction();
  try {
    if (enrollments.length === 0) {
      await StreamRating.destroy({
        where: { streamId: stream.id },
        transaction,
      });
    } else {
      const participantIds = enrollments.map((e) => e.participantId);

      for (let index = 0; index < stats.length; index++) {
        const { enrollment, filledDays, entryWeight, currentWeight, weightLossPercent } =
          stats[index];
        const rank = index + 1;

        const existing = await StreamRating.findOne({
          where: {
            streamId: stream.id,
            participantId: enrollment.participantId,
          },
          transaction,
        });

        if (existing) {
          existing.filledDays = filledDays;
          existing.entryWeight = entryWeight;
          existing.currentWeight = currentWeight;
          existing.weightLossPercent = weightLossPercent;
          existing.rank = rank;
          existing.calculatedAt = calculatedAt;
          await existing.save({ transaction });
        } else {
          await StreamRating.create(
            {
              streamId: stream.id,
              participantId: enrollment.participantId,
              filledDays,
              entryWeight,
              currentWeight,
              weightLossPercent,
              rank,
              calculatedAt,
            },
            { transaction }
          );
        }
      }

      await StreamRating.destroy({
        where: {
          streamId: stream.id,
          participantId: { [Op.notIn]: participantIds },
        },
        transaction,
      });
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function calculateAllRatings(): Promise<{
  processed: number;
  errors: Array<{ streamId: string; message: string }>;
}> {
  const streams = await Stream.findAll({
    where: {
      status: { [Op.in]: ['running', 'finished'] as StreamStatus[] },
    },
  });

  const errors: Array<{ streamId: string; message: string }> = [];
  let processed = 0;

  for (const stream of streams) {
    try {
      await calculateRatingsForStream(stream.id);
      processed++;
    } catch (error) {
      errors.push({
        streamId: stream.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { processed, errors };
}
