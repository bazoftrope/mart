import {
  Conversation,
  ConversationMember,
  Message,
  Stream,
  MarathonTemplate,
  User,
  type MessageAttachment,
} from '@db/models';
import { Forbidden, NotFound } from '@/lib/errors';
import { Op } from 'sequelize';

export async function findOrCreatePairConversation(
  streamId: string,
  participantId: string,
  mentorId: string
): Promise<Conversation> {
  const candidates = await Conversation.findAll({
    where: { type: 'mentor_pair', streamId },
  });

  for (const candidate of candidates) {
    const member = await ConversationMember.findOne({
      where: { conversationId: candidate.id, userId: participantId },
    });
    if (member) {
      return candidate;
    }
  }

  const conversation = await Conversation.create({
    type: 'mentor_pair',
    streamId,
  });

  await ConversationMember.bulkCreate([
    { conversationId: conversation.id, userId: participantId, role: 'participant' },
    { conversationId: conversation.id, userId: mentorId, role: 'mentor' },
  ]);

  return conversation;
}

export async function findOrCreateGroupConversation(
  streamId: string,
  mentorId: string,
  participantIds: string[]
): Promise<Conversation> {
  const existing = await Conversation.findOne({
    where: { type: 'group', streamId },
  });

  if (existing) {
    return existing;
  }

  const conversation = await Conversation.create({
    type: 'group',
    streamId,
  });

  await ConversationMember.bulkCreate([
    { conversationId: conversation.id, userId: mentorId, role: 'mentor' },
    ...participantIds.map((participantId) => ({
      conversationId: conversation.id,
      userId: participantId,
      role: 'participant' as const,
    })),
  ]);

  return conversation;
}

export type ConversationAccess = {
  conversation: Conversation;
  member: ConversationMember;
  stream?: Stream;
  template?: MarathonTemplate;
};

export async function getConversationAccess(
  conversationId: string,
  userId: string
): Promise<ConversationAccess> {
  const member = await ConversationMember.findOne({
    where: { conversationId, userId },
  });
  if (!member) {
    throw new Forbidden('You do not have access to this conversation');
  }

  const conversation = await Conversation.findByPk(conversationId);
  if (!conversation) {
    throw new NotFound('Conversation not found');
  }

  let stream: Stream | undefined;
  let template: MarathonTemplate | undefined;
  if (conversation.streamId) {
    stream = (await Stream.findByPk(conversation.streamId)) ?? undefined;
    if (stream) {
      template =
        (await MarathonTemplate.findByPk(stream.templateId)) ?? undefined;
    }
  }

  return { conversation, member, stream, template };
}

export async function sendMessage(
  conversation: Conversation,
  senderId: string,
  text: string,
  attachments?: MessageAttachment[] | null
): Promise<Message> {
  const message = await Message.create({
    conversationId: conversation.id,
    senderId,
    text,
    attachments: attachments && attachments.length > 0 ? attachments : null,
  });

  await ConversationMember.increment('unreadCount', {
    where: {
      conversationId: conversation.id,
      userId: { [Op.ne]: senderId },
    },
  });

  return message;
}

export async function markConversationRead(
  conversationId: string,
  userId: string
): Promise<void> {
  await ConversationMember.update(
    { lastReadAt: new Date(), unreadCount: 0 },
    { where: { conversationId, userId } }
  );
}

export function serializeConversationParticipant(user: User) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
