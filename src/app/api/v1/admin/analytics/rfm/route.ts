import { NextRequest } from 'next/server';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/utils/api-response';

export const GET = withRole('admin', 'manager')(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(365, Math.max(7, Number(searchParams.get('days')) || 90));
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get customers with order stats
    const customers = await prisma.order.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: since },
        userId: { not: null },
        NOT: [{ status: 'cancelled' }, { status: 'returned' }],
      },
      _count: { id: true },
      _sum: { totalAmount: true },
      _max: { createdAt: true },
    });

    const now = new Date();
    const totalCustomers = customers.length;

    // Calculate RFM scores for each customer
    const rfmData = customers.map((c) => {
      const recency = Math.floor((now.getTime() - new Date(c._max.createdAt!).getTime()) / (1000 * 60 * 60 * 24));
      const frequency = c._count.id;
      const monetary = Number(c._sum.totalAmount) || 0;
      return { recency, frequency, monetary };
    });

    // Calculate percentiles for scoring
    const recencies = rfmData.map((d) => d.recency).sort((a, b) => a - b);
    const frequencies = rfmData.map((d) => d.frequency).sort((a, b) => a - b);
    const monetaries = rfmData.map((d) => d.monetary).sort((a, b) => a - b);

    const percentile = (arr: number[], p: number) => arr[Math.floor(arr.length * p)] || 0;

    const rThresholds = [percentile(recencies, 0.25), percentile(recencies, 0.5), percentile(recencies, 0.75)];
    const fThresholds = [percentile(frequencies, 0.25), percentile(frequencies, 0.5), percentile(frequencies, 0.75)];
    const mThresholds = [percentile(monetaries, 0.25), percentile(monetaries, 0.5), percentile(monetaries, 0.75)];

    const score = (val: number, thresholds: number[], inverse = false) => {
      if (inverse) {
        if (val <= thresholds[0]) return 4;
        if (val <= thresholds[1]) return 3;
        if (val <= thresholds[2]) return 2;
        return 1;
      }
      if (val <= thresholds[0]) return 1;
      if (val <= thresholds[1]) return 2;
      if (val <= thresholds[2]) return 3;
      return 4;
    };

    // Segment based on RFM scores
    const segmentCounts: Record<string, { count: number; totalR: number; totalF: number; totalM: number }> = {};

    for (const d of rfmData) {
      const rScore = score(d.recency, rThresholds, true); // Lower recency = better
      const fScore = score(d.frequency, fThresholds);
      const mScore = score(d.monetary, mThresholds);

      let segment: string;
      if (rScore >= 4 && fScore >= 4) segment = 'champions';
      else if (rScore >= 3 && fScore >= 3) segment = 'loyal';
      else if (rScore >= 3 && fScore >= 2) segment = 'potential_loyal';
      else if (rScore >= 4 && fScore === 1) segment = 'recent';
      else if (rScore >= 2 && fScore >= 2 && mScore >= 2) segment = 'promising';
      else if (rScore === 2 && fScore >= 2) segment = 'needs_attention';
      else if (rScore === 2 && fScore === 1) segment = 'about_to_sleep';
      else if (rScore === 1 && fScore >= 2) segment = 'at_risk';
      else if (rScore === 1 && fScore === 1 && mScore <= 2) segment = 'lost';
      else segment = 'hibernating';

      if (!segmentCounts[segment]) segmentCounts[segment] = { count: 0, totalR: 0, totalF: 0, totalM: 0 };
      segmentCounts[segment].count++;
      segmentCounts[segment].totalR += d.recency;
      segmentCounts[segment].totalF += d.frequency;
      segmentCounts[segment].totalM += d.monetary;
    }

    const segments = Object.entries(segmentCounts)
      .map(([segment, data]) => ({
        segment,
        label: segment,
        count: data.count,
        avgRecency: Math.round(data.totalR / data.count),
        avgFrequency: data.totalF / data.count,
        avgMonetary: data.totalM / data.count,
        color: '',
      }))
      .sort((a, b) => b.count - a.count);

    return successResponse({ segments, totalCustomers });
  } catch (error) {
    console.error('[RFM Analysis]', error);
    return errorResponse('Помилка аналізу RFM', 500);
  }
});
