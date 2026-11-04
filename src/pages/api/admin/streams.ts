import type { NextApiRequest, NextApiResponse } from 'next';
import { Op } from 'sequelize';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAdmin } from '@/lib/middleware';
import {
  Stream,
  MarathonTemplate,
  User,
  StreamEnrollment,
  StreamRating,
  Conversation,
  Message,
  DailyReport,
} from '@db/models';
import { sequelize } from '@db/db';
import { ensureStreamStatusFor } from '@/lib/streamStatus';

async function getHandler(_req: NextApiRequest, res: NextApiResponse) {
  const streams = await Stream.findAll({
    order: [['start_date', 'DESC']],
  });

  const streamIds = streams.map((stream) => stream.id);

  const templateIds = Array.from(new Set(streams.map((s) => s.templateId)));
  const templates = templateIds.length
    ? await MarathonTemplate.findAll({ where: { id: templateIds } })
    : [];
  const templateMap = new Map(templates.map((t) => [t.id, t]));

  const mentorIds = Array.from(new Set(templates.map((t) => t.mentorId)));
  const mentors = mentorIds.length
    ? await User.findAll({
        where: { id: mentorIds },
        attributes: ['id', 'name', 'email'],
      })
    : [];
  const mentorMap = new Map(mentors.map((m) => [m.id, m]));

  for (const stream of streams) {
    const template = templateMap.get(stream.templateId);
    stream.status = await ensureStreamStatusFor(
      stream,
      template?.durationDays ?? 0
    );
  }

  const enrollments = streamIds.length
    ? ((await StreamEnrollment.findAll({
        attributes: ['id', 'streamId'],
        where: { streamId: { [Op.in]: streamIds } },
        raw: true,
      })) as unknown as Array<{ id: string; streamId: string }>)
    : [];

  const enrollmentToStream = new Map(
    enrollments.map((e) => [e.id, e.streamId])
  );
  const enrollmentsCount = new Map<string, number>();
  for (const enrollment of enrollments) {
    enrollmentsCount.set(
      enrollment.streamId,
      (enrollmentsCount.get(enrollment.streamId) ?? 0) + 1
    );
  }

  const enrollmentIds = enrollments.map((e) => e.id);
  const reportRows = enrollmentIds.length
    ? ((await DailyReport.findAll({
        attributes: [
          'enrollmentId',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        where: { enrollmentId: { [Op.in]: enrollmentIds } },
        group: ['enrollmentId'],
        raw: true,
      })) as unknown as Array<{ enrollmentId: string; count: string }>)
    : [];
  const reportsCount = new Map<string, number>();
  for (const row of reportRows) {
    const streamId = enrollmentToStream.get(row.enrollmentId);
    if (!streamId) continue;
    reportsCount.set(
      streamId,
      (reportsCount.get(streamId) ?? 0) + Number(row.count)
    );
  }

  const ratingRows = streamIds.length
    ? ((await StreamRating.findAll({
        attributes: [
          'streamId',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        where: { streamId: { [Op.in]: streamIds } },
        group: ['streamId'],
        raw: true,
      })) as unknown as Array<{ streamId: string; count: string }>)
    : [];
  const ratingsCount = new Map(
    ratingRows.map((row) => [row.streamId, Number(row.count)])
  );

  const conversations = streamIds.length
    ? ((await Conversation.findAll({
        attributes: ['id', 'streamId'],
        where: { streamId: { [Op.in]: streamIds } },
        raw: true,
      })) as unknown as Array<{ id: string; streamId: string | null }>)
    : [];
  const conversationToStream = new Map(
    conversations.map((c) => [c.id, c.streamId])
  );
  const conversationIds = conversations.map((c) => c.id);
  const messageRows = conversationIds.length
    ? ((await Message.findAll({
        attributes: [
          'conversationId',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        where: { conversationId: { [Op.in]: conversationIds } },
        group: ['conversationId'],
        raw: true,
      })) as unknown as Array<{ conversationId: string; count: string }>)
    : [];
  const messagesCount = new Map<string, number>();
  for (const row of messageRows) {
    const streamId = conversationToStream.get(row.conversationId);
    if (!streamId) continue;
    messagesCount.set(
      streamId,
      (messagesCount.get(streamId) ?? 0) + Number(row.count)
    );
  }

  const data = streams.map((stream) => {
    const template = templateMap.get(stream.templateId);
    const mentor = template ? mentorMap.get(template.mentorId) : null;

    return {
      id: stream.id,
      startDate: stream.startDate,
      status: stream.status,
      createdAt: stream.createdAt,
      template: template
        ? {
            id: template.id,
            title: template.title,
            durationDays: template.durationDays,
          }
        : null,
      mentor: mentor
        ? {
            id: mentor.id,
            name: mentor.name,
            email: mentor.email,
          }
        : null,
      enrollmentsCount: enrollmentsCount.get(stream.id) ?? 0,
      reportsCount: reportsCount.get(stream.id) ?? 0,
      ratingsCount: ratingsCount.get(stream.id) ?? 0,
      messagesCount: messagesCount.get(stream.id) ?? 0,
    };
  });

  return success(res, data);
}

export default apiHandler({
  GET: withAdmin(getHandler),
});
