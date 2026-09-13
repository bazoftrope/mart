import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { sequelize } from '@db/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAuth } from '@/lib/middleware';
import {
  Conversation,
  ConversationMember,
  Message,
  Stream,
  MarathonTemplate,
  StreamEnrollment,
  User,
} from '@db/models';
import { createConversationSchema } from '@/lib/validation';
import { Forbidden, NotFound } from '@/lib/errors';
import { Op } from 'sequelize';
import {
  findOrCreatePairConversation,
  findOrCreateGroupConversation,
  serializeConversationParticipant,
} from '@/services/messageService';
import type { AuthenticatedRequest } from '@/types/auth';

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as AuthenticatedRequest;

  const parsed = createConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const { type, streamId } = parsed.data;
  let { participantId } = parsed.data;

  if (type === 'mentor_pair') {
    if (!participantId) {
      if (user.role === 'mentor') {
        throw new Forbidden('Participant is required for a mentor pair conversation');
      }
      participantId = user.userId;
    }

    const stream = await Stream.findByPk(streamId!);
    if (!stream) {
      throw new NotFound('Stream not found');
    }
    if (stream.status === 'finished') {
      throw new Forbidden('Чат потока закрыт');
    }
    const template = await MarathonTemplate.findByPk(stream.templateId);
    if (!template) {
      throw new NotFound('Template not found');
    }

    const participant = await User.findByPk(participantId!);
    if (!participant) {
      throw new NotFound('Participant not found');
    }

    const enrollment = await StreamEnrollment.findOne({
      where: { streamId: stream.id, participantId: participantId! },
    });
    if (!enrollment) {
      throw new Forbidden('Participant is not enrolled in this stream');
    }

    const isMentor = template.mentorId === user.userId;
    const isParticipant = participantId === user.userId;

    if (!isMentor && !isParticipant) {
      throw new Forbidden('You cannot start this conversation');
    }

    const conversation = await findOrCreatePairConversation(
      stream.id,
      participantId!,
      template.mentorId
    );

    const members = await ConversationMember.findAll({
      where: { conversationId: conversation.id },
    });
    const memberIds = members.map((m) => m.userId);
    const memberUsers = await User.findAll({
      where: { id: memberIds },
      attributes: ['id', 'name', 'email', 'role'],
    });

    return success(
      res,
      {
        id: conversation.id,
        type: conversation.type,
        streamId: conversation.streamId,
        stream: {
          id: stream.id,
          status: stream.status,
          startDate: stream.startDate,
          template: {
            id: template.id,
            title: template.title,
            durationDays: template.durationDays,
          },
        },
        members: memberUsers.map(serializeConversationParticipant),
        myMemberId: user.userId,
      },
      201
    );
  }

  // group
  const stream = await Stream.findByPk(streamId!);
  if (!stream) {
    throw new NotFound('Stream not found');
  }
  if (stream.status === 'finished') {
    throw new Forbidden('Чат потока закрыт');
  }
  const template = await MarathonTemplate.findByPk(stream.templateId);
  if (!template) {
    throw new NotFound('Template not found');
  }

  const isMentor = template.mentorId === user.userId;
  const enrollment = await StreamEnrollment.findOne({
    where: { streamId: stream.id, participantId: user.userId },
  });
  if (!isMentor && !enrollment) {
    throw new Forbidden('You are not a member of this stream');
  }

  const enrollments = await StreamEnrollment.findAll({
    where: { streamId: stream.id },
  });
  const participantIds = enrollments.map((e) => e.participantId);
  const conversation = await findOrCreateGroupConversation(
    stream.id,
    template.mentorId,
    participantIds
  );

  const members = await ConversationMember.findAll({
    where: { conversationId: conversation.id },
  });
  const memberIds = members.map((m) => m.userId);
  const memberUsers = await User.findAll({
    where: { id: memberIds },
    attributes: ['id', 'name', 'email', 'role'],
  });

  return success(
    res,
    {
      id: conversation.id,
      type: conversation.type,
      streamId: conversation.streamId,
      stream: {
        id: stream.id,
        status: stream.status,
        startDate: stream.startDate,
        template: {
          id: template.id,
          title: template.title,
          durationDays: template.durationDays,
        },
      },
      members: memberUsers.map(serializeConversationParticipant),
      myMemberId: user.userId,
    },
    201
  );
}

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as AuthenticatedRequest;

  const memberships = await ConversationMember.findAll({
    where: { userId: user.userId },
  });
  const conversationIds = memberships.map((m) => m.conversationId);
  if (conversationIds.length === 0) {
    return success(res, []);
  }

  const conversations = await Conversation.findAll({
    where: { id: conversationIds },
    order: [['updated_at', 'DESC']],
  });

  const streamIds = conversations
    .map((c) => c.streamId)
    .filter((id): id is string => !!id);
  const streams = streamIds.length
    ? await Stream.findAll({ where: { id: streamIds } })
    : [];
  const streamMap = new Map(streams.map((s) => [s.id, s]));

  const templateIds = Array.from(
    new Set(streams.map((s) => s.templateId))
  );
  const templates = templateIds.length
    ? await MarathonTemplate.findAll({ where: { id: templateIds } })
    : [];
  const templateMap = new Map(templates.map((t) => [t.id, t]));

  const memberIds = memberships.map((m) => m.userId);
  const users = memberIds.length
    ? await User.findAll({
        where: { id: memberIds },
        attributes: ['id', 'name', 'email', 'role'],
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const lastMessages = await Message.findAll({
    where: {
      id: {
        [Op.in]: sequelize.literal(
          `(SELECT DISTINCT ON (conversation_id) id FROM messages ` +
            `WHERE conversation_id IN (${conversationIds
              .map((id) => `'${id}'`)
              .join(', ')}) ` +
            `ORDER BY conversation_id, created_at DESC)`
        ),
      },
    },
    order: [['created_at', 'DESC']],
  });
  const lastMessageByConversation = new Map<
    string,
    { id: string; text: string; senderId: string; createdAt: string }
  >();
  for (const msg of lastMessages) {
    if (!lastMessageByConversation.has(msg.conversationId)) {
      lastMessageByConversation.set(msg.conversationId, {
        id: msg.id,
        text: msg.text,
        senderId: msg.senderId,
        createdAt: msg.createdAt.toISOString(),
      });
    }
  }

  const myMemberByConversation = new Map<string, ConversationMember>();
  for (const m of memberships) {
    myMemberByConversation.set(m.conversationId, m);
  }

  const data = conversations
    .map((conversation) => {
      const stream = conversation.streamId
        ? streamMap.get(conversation.streamId)
        : undefined;
      const template = stream
        ? templateMap.get(stream.templateId)
        : undefined;
      const myMember = myMemberByConversation.get(conversation.id);

      const conversationMembers = memberships
        .filter((m) => m.conversationId === conversation.id)
        .map((m) => {
          const memberUser = userMap.get(m.userId);
          return memberUser
            ? serializeConversationParticipant(memberUser)
            : null;
        })
        .filter((m): m is ReturnType<typeof serializeConversationParticipant> => !!m);

      const otherMember = conversationMembers.find(
        (m) => m.id !== user.userId
      );

      return {
        id: conversation.id,
        type: conversation.type,
        streamId: conversation.streamId,
        stream: stream
          ? {
              id: stream.id,
              status: stream.status,
              startDate: stream.startDate,
              template: template
                ? {
                    id: template.id,
                    title: template.title,
                    durationDays: template.durationDays,
                  }
                : null,
            }
          : null,
        members: conversationMembers,
        otherMember: otherMember ?? null,
        lastMessage: lastMessageByConversation.get(conversation.id) ?? null,
        unreadCount: myMember?.unreadCount ?? 0,
        updatedAt: conversation.updatedAt.toISOString(),
      };
    })
    .sort((a, b) => {
      const aTime =
        a.lastMessage?.createdAt || a.updatedAt;
      const bTime =
        b.lastMessage?.createdAt || b.updatedAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

  return success(res, data);
}

export default apiHandler({
  GET: withAuth(getHandler),
  POST: withAuth(postHandler),
});
