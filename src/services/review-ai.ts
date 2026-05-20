import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Classify reviews via Anthropic Messages API and persist sentiment + suggested
 * draft reply. The owner reviews each draft and one-clicks publish.
 *
 * Uses native fetch instead of the SDK to avoid adding a dependency. If the API
 * key is missing or the call fails, we no-op gracefully — the admin UI just
 * shows reviews without AI annotations.
 */

const MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

type Sentiment = 'positive' | 'negative' | 'question' | 'neutral';

interface ClassificationResult {
  sentiment: Sentiment;
  suggestedReply: string;
}

interface ReviewInput {
  id: number;
  rating: number;
  title: string | null;
  comment: string | null;
  productName: string;
}

function buildPrompt(review: ReviewInput): string {
  return [
    `Ти — асистент магазину побутової хімії pulito.trade. Класифікуй відгук та запропонуй коротку увічливу відповідь українською.`,
    ``,
    `Товар: ${review.productName}`,
    `Рейтинг: ${review.rating}/5`,
    review.title ? `Заголовок: ${review.title}` : '',
    `Відгук:`,
    review.comment ?? '(без тексту)',
    ``,
    `Поверни JSON у форматі: {"sentiment": "positive|negative|question|neutral", "reply": "..."}`,
    `Відповідь має бути 1-3 речення, людська, без офіційщини. Для negative — щиро вибачитися і запропонувати контакт. Для question — відповісти або скерувати у підтримку.`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function callClaude(prompt: string): Promise<ClassificationResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.warn('[review-ai] ANTHROPIC_API_KEY not set, skipping classification');
    return null;
  }

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      logger.warn('[review-ai] anthropic request failed', { status: res.status });
      return null;
    }

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = data.content?.[0]?.text ?? '';
    // Try to extract JSON even when the model wraps it in prose
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Partial<ClassificationResult>;
    if (!parsed.sentiment || !parsed.suggestedReply) {
      // older prompt variant may use "reply"
      const alt = JSON.parse(match[0]) as { sentiment?: string; reply?: string };
      if (alt.sentiment && alt.reply) {
        return {
          sentiment: alt.sentiment as Sentiment,
          suggestedReply: alt.reply,
        };
      }
      return null;
    }
    return {
      sentiment: parsed.sentiment as Sentiment,
      suggestedReply: parsed.suggestedReply,
    };
  } catch (err) {
    logger.warn('[review-ai] classification error', { error: String(err) });
    return null;
  }
}

/**
 * Classify a single review by ID (used from the admin UI for on-demand processing).
 */
export async function classifyReviewById(reviewId: number) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { product: { select: { name: true } } },
  });
  if (!review) return null;

  const result = await callClaude(
    buildPrompt({
      id: review.id,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      productName: review.product.name,
    }),
  );

  if (!result) return null;

  return prisma.review.update({
    where: { id: reviewId },
    data: {
      sentiment: result.sentiment,
      aiSuggestedReply: result.suggestedReply,
      aiClassifiedAt: new Date(),
    },
  });
}

/**
 * Background classification for all unclassified reviews. Suitable for a nightly
 * cron — processes in small batches to keep API costs predictable.
 */
export async function classifyPendingReviews(maxToProcess = 25): Promise<{
  processed: number;
  failed: number;
}> {
  const pending = await prisma.review.findMany({
    where: {
      aiClassifiedAt: null,
      OR: [{ comment: { not: null } }, { title: { not: null } }],
    },
    include: { product: { select: { name: true } } },
    take: maxToProcess,
    orderBy: { createdAt: 'desc' },
  });

  let processed = 0;
  let failed = 0;
  for (const r of pending) {
    const result = await callClaude(
      buildPrompt({
        id: r.id,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        productName: r.product.name,
      }),
    );
    if (!result) {
      failed += 1;
      continue;
    }
    await prisma.review.update({
      where: { id: r.id },
      data: {
        sentiment: result.sentiment,
        aiSuggestedReply: result.suggestedReply,
        aiClassifiedAt: new Date(),
      },
    });
    processed += 1;
  }
  return { processed, failed };
}

/**
 * Publish the AI draft as the admin reply (or use a custom edited version).
 */
export async function publishReply(reviewId: number, replyText: string) {
  return prisma.review.update({
    where: { id: reviewId },
    data: {
      adminReply: replyText,
      adminReplyAt: new Date(),
    },
  });
}
