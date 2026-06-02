import { prisma } from '@/lib/prisma';
import { GRAPH_API_VERSION } from '@/services/meta-graph';
import { getInstagramCreds } from '@/services/channel-config';

interface InsightMetric {
  name: string;
  period: string;
  values: { value: number; end_time: string }[];
}

/**
 * Fetch daily Instagram Insights and store them in analytics.
 */
export async function collectInstagramInsights(): Promise<{
  collected: boolean;
  metricsCount: number;
  error?: string;
}> {
  const { accessToken, businessAccountId } = await getInstagramCreds();
  if (!accessToken || !businessAccountId) {
    return { collected: false, metricsCount: 0, error: 'Instagram credentials not configured' };
  }

  try {
    // `reach` + `views` are the current user-level metrics. `impressions` and
    // `profile_views` were deprecated by Meta (error on newer Graph versions),
    // which is why this call had been failing on the old v18.0.
    const metrics = 'reach,views';
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${businessAccountId}/insights?metric=${metrics}&period=day&access_token=${accessToken}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      const body = await res.text();
      return {
        collected: false,
        metricsCount: 0,
        error: `Instagram API error: ${res.status} ${body}`,
      };
    }

    const data = (await res.json()) as { data: InsightMetric[] };
    let metricsCount = 0;

    for (const metric of data.data) {
      for (const value of metric.values) {
        await prisma.clientEvent.create({
          data: {
            eventType: `instagram_${metric.name}`,
            metadata: { value: value.value, endTime: value.end_time },
            createdAt: new Date(value.end_time),
          },
        });
        metricsCount++;
      }
    }

    return { collected: true, metricsCount };
  } catch (err) {
    return {
      collected: false,
      metricsCount: 0,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
