import { prisma } from '@/lib/prisma';

export interface AutoReplyMatch {
  id: number;
  responseText: string;
  responseImage: string | null;
  buttons: unknown;
}

/**
 * Find the highest-priority active auto-reply matching the given message text.
 *
 * Trigger types:
 *  - 'keyword': case-insensitive substring match against triggerText (fallback default)
 *  - 'exact': case-insensitive full-string equality
 *  - 'regex': triggerText is a JS regex source; matches if pattern.test(text) is true
 *
 * Returns null when nothing matches or text is empty.
 */
export async function findAutoReply(
  platform: string,
  text: string | null | undefined,
): Promise<AutoReplyMatch | null> {
  if (!text) return null;
  const cleaned = text.trim();
  if (cleaned.length === 0) return null;

  let rules: Array<{
    id: number;
    triggerType: string;
    triggerText: string | null;
    responseText: string;
    responseImage: string | null;
    buttons: unknown;
  }>;
  try {
    rules = (await prisma.botAutoReply.findMany({
      where: { platform, isActive: true },
      orderBy: [{ priority: 'desc' }, { id: 'asc' }],
    })) as never;
  } catch {
    return null;
  }

  if (rules.length === 0) return null;

  const lower = cleaned.toLowerCase();

  for (const rule of rules) {
    const trigger = (rule.triggerText ?? '').trim();
    if (trigger.length === 0) continue;

    const triggerType = rule.triggerType || 'keyword';

    if (triggerType === 'exact') {
      if (lower === trigger.toLowerCase()) {
        return ruleToMatch(rule);
      }
      continue;
    }

    if (triggerType === 'regex') {
      try {
        const pattern = new RegExp(trigger, 'i');
        if (pattern.test(cleaned)) {
          return ruleToMatch(rule);
        }
      } catch {
        // invalid regex — skip
      }
      continue;
    }

    // default: keyword
    if (lower.includes(trigger.toLowerCase())) {
      return ruleToMatch(rule);
    }
  }

  return null;
}

function ruleToMatch(rule: {
  id: number;
  responseText: string;
  responseImage: string | null;
  buttons: unknown;
}): AutoReplyMatch {
  return {
    id: rule.id,
    responseText: rule.responseText,
    responseImage: rule.responseImage,
    buttons: rule.buttons,
  };
}
