import { prisma } from '@/lib/prisma';

export interface PickedWelcome {
  id: number;
  variant: string;
  messageText: string;
  messageImage: string | null;
  buttons: unknown;
  promoCode: string | null;
  promoLink: string | null;
}

/**
 * Pick a random active welcome message for `platform`. Variants are weighted
 * uniformly. Returns null when no rules exist for the platform.
 *
 * Increments `impressions` atomically as a side-effect so the A/B test gets
 * accurate exposure counts.
 */
export async function pickWelcomeMessage(platform: string): Promise<PickedWelcome | null> {
  let candidates;
  try {
    candidates = await prisma.botWelcomeMessage.findMany({
      where: { platform, isActive: true },
      orderBy: { id: 'asc' },
    });
  } catch {
    return null;
  }

  if (candidates.length === 0) return null;

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];

  // Best-effort impression bump — failure must not block the bot reply.
  try {
    await prisma.botWelcomeMessage.update({
      where: { id: chosen.id },
      data: { impressions: { increment: 1 } },
    });
  } catch {
    // ignore
  }

  return {
    id: chosen.id,
    variant: chosen.variant,
    messageText: chosen.messageText,
    messageImage: chosen.messageImage,
    buttons: chosen.buttons,
    promoCode: chosen.promoCode,
    promoLink: chosen.promoLink,
  };
}

/**
 * Record a conversion against the most recent welcome message a user saw.
 * Used when a guest who first interacted via the bot later places an order.
 */
export async function recordWelcomeConversion(welcomeId: number): Promise<void> {
  try {
    await prisma.botWelcomeMessage.update({
      where: { id: welcomeId },
      data: { conversions: { increment: 1 } },
    });
  } catch {
    // ignore
  }
}
