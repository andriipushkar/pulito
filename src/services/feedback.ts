import { Prisma } from '@/../generated/prisma';
import { prisma } from '@/lib/prisma';

export class FeedbackError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'FeedbackError';
  }
}

export async function createFeedback(data: {
  name: string;
  email?: string;
  phone?: string;
  subject?: string;
  message: string;
  type: 'form' | 'callback';
}) {
  return prisma.feedback.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      subject: data.subject,
      message: data.message,
      type: data.type,
      status: 'new_feedback',
    },
  });
}

export async function getFeedbackList(filters: {
  page: number;
  limit: number;
  type?: 'form' | 'callback';
  status?: 'new_feedback' | 'processed' | 'rejected';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const where: Prisma.FeedbackWhereInput = {};
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const skip = (filters.page - 1) * filters.limit;

  const [items, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: filters.limit,
      include: { processor: { select: { id: true, fullName: true } } },
    }),
    prisma.feedback.count({ where }),
  ]);

  return { items, total };
}

export async function updateFeedbackStatus(
  id: number,
  status: 'processed' | 'rejected',
  processedBy: number
) {
  const feedback = await prisma.feedback.findUnique({ where: { id } });
  if (!feedback) throw new FeedbackError('Зворотний зв\'язок не знайдено', 404);

  return prisma.feedback.update({
    where: { id },
    data: { status, processedBy, processedAt: new Date() },
  });
}
