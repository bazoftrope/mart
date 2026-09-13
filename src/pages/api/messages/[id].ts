import type { NextApiRequest, NextApiResponse } from 'next';
import '@/lib/db';
import { apiHandler, success } from '@/lib/apiHandler';
import { withAuth } from '@/lib/middleware';
import { Message, ConversationMember, User } from '@db/models';
import { sendMessageSchema } from '@/lib/validation';
import { Forbidden, NotFound } from '@/lib/errors';
import {
  getConversationAccess,
  sendMessage,
  markConversationRead,
  serializeConversationParticipant,
} from '@/services/messageService';
import type { AuthenticatedRequest } from '@/types/auth';

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function getHandler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as AuthenticatedRequest;
  const conversationId = single(req.query.id);
  if (!conversationId) {
    throw new NotFound('Conversation not found');
  }

  const { conversation } = await getConversationAccess(
    conversationId,
    user.userId
  );

  const messages = await Message.findAll({
    where: { conversationId: conversation.id },
    order: [['created_at', 'ASC']],
  });

  const senderIds = Array.from(new Set(messages.map((m) => m.senderId)));
  const senders = senderIds.length
    ? await User.findAll({
        where: { id: senderIds },
        attributes: ['id', 'name', 'email', 'role'],
      })
    : [];
  const senderMap = new Map(senders.map((s) => [s.id, s]));

  const members = await ConversationMember.findAll({
    where: { conversationId: conversation.id },
  });
  const memberIds = members.map((m) => m.userId);
  const memberUsers = await User.findAll({
    where: { id: memberIds },
    attributes: ['id', 'name', 'email', 'role'],
  });

  await markConversationRead(conversation.id, user.userId);

  return success(res, {
    id: conversation.id,
    type: conversation.type,
    streamId: conversation.streamId,
    members: memberUsers.map(serializeConversationParticipant),
    messages: messages.map((msg) => ({
      id: msg.id,
      text: msg.text,
      senderId: msg.senderId,
      sender: senderMap.get(msg.senderId)
        ? serializeConversationParticipant(senderMap.get(msg.senderId)!)
        : null,
      createdAt: msg.createdAt.toISOString(),
    })),
  });
}

async function postHandler(req: NextApiRequest, res: NextApiResponse) {
  const { user } = req as AuthenticatedRequest;
  const conversationId = single(req.query.id);
  if (!conversationId) {
    throw new NotFound('Conversation not found');
  }

  const { conversation, stream } = await getConversationAccess(
    conversationId,
    user.userId
  );
  if (stream?.status === 'finished') {
    throw new Forbidden('Чат потока закрыт');
  }

  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    throw parsed.error;
  }

  const message = await sendMessage(
    conversation,
    user.userId,
    parsed.data.text
  );

  return success(
    res,
    {
      id: message.id,
      text: message.text,
      senderId: message.senderId,
      createdAt: message.createdAt.toISOString(),
    },
    201
  );
}

export default apiHandler({
  GET: withAuth(getHandler),
  POST: withAuth(postHandler),
});
