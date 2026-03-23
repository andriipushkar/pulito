import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockPrismaClient } from '@/test/prisma-mock';
import {
  createRoom,
  sendMessage,
  getMessages,
  assignAgent,
  markMessagesAsRead,
  getUnreadCount,
} from './chat';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    chatRoom: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    chatMessage: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from '@/lib/prisma';

const mockPrisma = prisma as unknown as MockPrismaClient;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createRoom', () => {
  it('should create a room with open status', async () => {
    const mockRoom = { id: 1, userId: 1, status: 'open', subject: null };
    mockPrisma.chatRoom.create.mockResolvedValue(mockRoom as never);

    const result = await createRoom(1);

    expect(result).toEqual(mockRoom);
    expect(mockPrisma.chatRoom.create).toHaveBeenCalledWith({
      data: { userId: 1, subject: undefined },
    });
  });

  it('should create a room with subject', async () => {
    const mockRoom = { id: 2, userId: 1, status: 'open', subject: 'Help needed' };
    mockPrisma.chatRoom.create.mockResolvedValue(mockRoom as never);

    const result = await createRoom(1, 'Help needed');

    expect(result).toEqual(mockRoom);
    expect(mockPrisma.chatRoom.create).toHaveBeenCalledWith({
      data: { userId: 1, subject: 'Help needed' },
    });
  });
});

describe('sendMessage', () => {
  it('should create message and update lastMessageAt via transaction', async () => {
    const mockMessage = { id: 1, roomId: 1, content: 'Hello', senderType: 'customer' };
    mockPrisma.$transaction.mockResolvedValue([mockMessage, {}] as never);

    const result = await sendMessage(1, 'customer', 1, 'Hello');

    expect(result).toEqual(mockMessage);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('should return the created message from transaction', async () => {
    const mockMessage = { id: 2, roomId: 1, content: 'See file', attachmentUrl: 'https://example.com/file.pdf' };
    mockPrisma.$transaction.mockResolvedValue([mockMessage, {}] as never);

    const result = await sendMessage(1, 'agent', 2, 'See file', 'https://example.com/file.pdf');

    expect(result).toEqual(mockMessage);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('getMessages', () => {
  it('should return paginated results', async () => {
    const mockMessages = [{ id: 1 }, { id: 2 }];
    mockPrisma.chatMessage.findMany.mockResolvedValue(mockMessages as never);
    mockPrisma.chatMessage.count.mockResolvedValue(10);

    const result = await getMessages(1, { page: 1, limit: 20 });

    expect(result).toEqual({ messages: mockMessages, total: 10 });
    expect(mockPrisma.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { roomId: 1 }, skip: 0, take: 20 })
    );
  });

  it('should paginate correctly on page 2', async () => {
    mockPrisma.chatMessage.findMany.mockResolvedValue([] as never);
    mockPrisma.chatMessage.count.mockResolvedValue(0);

    await getMessages(1, { page: 2, limit: 10 });

    expect(mockPrisma.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
  });
});

describe('assignAgent', () => {
  it('should change status to assigned and set agentId', async () => {
    const mockRoom = { id: 1, assignedAgentId: 5, status: 'assigned' };
    mockPrisma.chatRoom.update.mockResolvedValue(mockRoom as never);

    const result = await assignAgent(1, 5);

    expect(result).toEqual(mockRoom);
    expect(mockPrisma.chatRoom.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { assignedAgentId: 5, status: 'assigned' },
    });
  });
});

describe('markMessagesAsRead', () => {
  it('should update isRead flag for customer viewing agent messages', async () => {
    mockPrisma.chatRoom.findUnique.mockResolvedValue({
      userId: 1,
      assignedAgentId: 5,
    } as never);
    mockPrisma.chatMessage.updateMany.mockResolvedValue({ count: 3 } as never);

    const result = await markMessagesAsRead(1, 1);

    expect(result).toEqual({ count: 3 });
    expect(mockPrisma.chatMessage.updateMany).toHaveBeenCalledWith({
      where: {
        roomId: 1,
        senderType: { not: 'customer' },
        isRead: false,
      },
      data: { isRead: true },
    });
  });

  it('should update isRead flag for agent viewing customer messages', async () => {
    mockPrisma.chatRoom.findUnique.mockResolvedValue({
      userId: 1,
      assignedAgentId: 5,
    } as never);
    mockPrisma.chatMessage.updateMany.mockResolvedValue({ count: 2 } as never);

    await markMessagesAsRead(1, 5);

    expect(mockPrisma.chatMessage.updateMany).toHaveBeenCalledWith({
      where: {
        roomId: 1,
        senderType: { equals: 'customer' },
        isRead: false,
      },
      data: { isRead: true },
    });
  });
});

describe('getUnreadCount', () => {
  it('should return correct count of unread messages', async () => {
    mockPrisma.chatMessage.count.mockResolvedValue(7);

    const result = await getUnreadCount(1);

    expect(result).toBe(7);
    expect(mockPrisma.chatMessage.count).toHaveBeenCalledWith({
      where: {
        room: { userId: 1 },
        senderType: { not: 'customer' },
        isRead: false,
      },
    });
  });
});
