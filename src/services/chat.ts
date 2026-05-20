import { prisma } from '@/lib/prisma';

export class ChatError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ChatError';
  }
}

/**
 * Create a new chat room for a user.
 */
export async function createRoom(userId: number, subject?: string) {
  return prisma.chatRoom.create({
    data: {
      userId,
      subject,
    },
  });
}

/**
 * Get all chat rooms for a specific user.
 */
export async function getRoomsByUser(userId: number) {
  return prisma.chatRoom.findMany({
    where: { userId },
    orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: {
        select: {
          messages: { where: { isRead: false, senderType: { not: 'customer' } } },
        },
      },
    },
  });
}

/**
 * Get a single chat room by ID with the last N messages.
 */
export async function getRoomById(roomId: number, messageLimit = 50) {
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: {
      user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      assignedAgent: { select: { id: true, fullName: true, email: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: messageLimit,
      },
    },
  });

  if (!room) {
    throw new ChatError('Чат не знайдено', 404);
  }

  // Reverse so messages are in chronological order
  room.messages.reverse();
  return room;
}

/**
 * Get all rooms for admin panel with pagination and status filter.
 */
export async function getAdminRooms(filters?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}) {
  const { page = 1, limit = 20, status, search } = filters || {};

  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { subject: { contains: search, mode: 'insensitive' } },
      { user: { fullName: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [rooms, total] = await Promise.all([
    prisma.chatRoom.findMany({
      where,
      orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        assignedAgent: { select: { id: true, fullName: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            messages: { where: { isRead: false } },
          },
        },
      },
    }),
    prisma.chatRoom.count({ where }),
  ]);

  return { rooms, total };
}

/**
 * Send a message in a chat room.
 */
export async function sendMessage(
  roomId: number,
  senderType: 'customer' | 'agent' | 'system',
  senderId: number | null,
  content: string,
  attachmentUrl?: string
) {
  const now = new Date();

  // The frontend renders attachmentUrl as a clickable link. Without validation
  // a customer could send `javascript:` or `data:` URLs and pop XSS on an
  // agent's screen. Limit to http(s) + reasonable length.
  if (attachmentUrl) {
    if (attachmentUrl.length > 2048) {
      throw new Error('attachmentUrl надто довгий (>2048 символів)');
    }
    try {
      const parsed = new URL(attachmentUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('attachmentUrl має використовувати http(s)');
      }
    } catch {
      throw new Error('attachmentUrl має бути валідним http(s) URL');
    }
  }

  const [message] = await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        roomId,
        senderType,
        senderId,
        content,
        attachmentUrl,
      },
    }),
    prisma.chatRoom.update({
      where: { id: roomId },
      data: { lastMessageAt: now },
    }),
  ]);

  return message;
}

/**
 * Get paginated messages for a room.
 */
export async function getMessages(
  roomId: number,
  pagination: { page?: number; limit?: number } = {}
) {
  const { page = 1, limit = 50 } = pagination;

  const [messages, total] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.chatMessage.count({ where: { roomId } }),
  ]);

  return { messages: messages.reverse(), total };
}

/**
 * Assign an agent to a chat room.
 */
export async function assignAgent(roomId: number, agentId: number) {
  return prisma.chatRoom.update({
    where: { id: roomId },
    data: {
      assignedAgentId: agentId,
      status: 'assigned',
    },
  });
}

/**
 * Mark a room as resolved.
 */
export async function resolveRoom(roomId: number) {
  return prisma.chatRoom.update({
    where: { id: roomId },
    data: { status: 'resolved' },
  });
}

/**
 * Close a room.
 */
export async function closeRoom(roomId: number) {
  return prisma.chatRoom.update({
    where: { id: roomId },
    data: { status: 'closed' },
  });
}

/**
 * Mark all messages in a room as read for a specific user.
 * For a customer, marks agent/system messages as read.
 * For an agent, marks customer messages as read.
 */
export async function markMessagesAsRead(roomId: number, userId: number) {
  // Get the room to determine the user's role in it
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    select: { userId: true, assignedAgentId: true },
  });

  if (!room) {
    throw new ChatError('Чат не знайдено', 404);
  }

  // If the user is the customer, mark agent/system messages as read
  // If the user is the agent, mark customer messages as read
  const isCustomer = room.userId === userId;
  const senderTypeFilter = isCustomer
    ? { not: 'customer' as const }
    : { equals: 'customer' as const };

  return prisma.chatMessage.updateMany({
    where: {
      roomId,
      senderType: senderTypeFilter,
      isRead: false,
    },
    data: { isRead: true },
  });
}

/**
 * Get count of unread messages for a user (across all their rooms).
 */
export async function getUnreadCount(userId: number) {
  return prisma.chatMessage.count({
    where: {
      room: { userId },
      senderType: { not: 'customer' },
      isRead: false,
    },
  });
}
