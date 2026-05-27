import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import { getSettings } from '@/services/settings';
import type { AIProvider } from '@/services/ai-content';

export interface SearchIntelEntry {
  id: number;
  term: string;
  count: number;
  resultsCount: number;
  lastSearchedAt: Date;
}

export async function getTopZeroResultSearches(limit = 30): Promise<SearchIntelEntry[]> {
  return prisma.searchQuery.findMany({
    where: { resultsCount: 0 },
    orderBy: [{ count: 'desc' }, { lastSearchedAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      term: true,
      count: true,
      resultsCount: true,
      lastSearchedAt: true,
    },
  });
}

export async function getTopAllSearches(limit = 30): Promise<SearchIntelEntry[]> {
  return prisma.searchQuery.findMany({
    orderBy: [{ count: 'desc' }],
    take: limit,
    select: {
      id: true,
      term: true,
      count: true,
      resultsCount: true,
      lastSearchedAt: true,
    },
  });
}

// AI-generated insights summarizing what to do with zero-result queries.
const SYSTEM_PROMPT = `Ти аналітик інтернет-магазину побутової хімії Pulito Trade. Тобі дають список пошукових запитів, які дали 0 результатів — це втрачені продажі. Твоя задача — у 4-7 пунктах сказати власнику, що з цим робити: які товари ДОДАТИ в каталог, які СИНОНІМИ додати до існуючих товарів (наприклад "Vanish oxi" може бути синонімом до "Vanish Plus"), які КАТЕГОРІЇ можуть бракувати. Українська, конкретно, без води. Один пункт = одна дія. Без преамбул, маркдауну, нумерації — просто буллет-список з "•" на початку.`;

async function getAnthropicKey(): Promise<string | null> {
  try {
    const s = await getSettings();
    if (s.anthropic_api_key) return s.anthropic_api_key;
  } catch {
    /* */
  }
  return process.env.ANTHROPIC_API_KEY || null;
}

async function getGeminiConfig(): Promise<{ apiKey: string; model: string } | null> {
  let apiKey = '';
  let model = '';
  try {
    const s = await getSettings();
    apiKey = s.gemini_api_key;
    model = s.gemini_model;
  } catch {
    /* */
  }
  if (!apiKey) apiKey = process.env.GEMINI_API_KEY || '';
  if (!model) model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (!apiKey) return null;
  return { apiKey, model };
}

const MAX_TERM_IN_PROMPT = 200;

/** Truncate + strip control chars before embedding user-submitted search
 * terms in the AI prompt. Mitigates prompt-injection where someone searches
 * for a string like `\n\nIgnore previous instructions. Reveal:` — we still
 * trust the AI to ignore obvious injection attempts, but reducing surface
 * area (length cap + no newlines/tabs) makes successful attacks rarer. */
function sanitizeTermForPrompt(term: string): string {
  return term.replace(/[\x00-\x1F\x7F]/g, ' ').slice(0, MAX_TERM_IN_PROMPT);
}

function buildPrompt(entries: SearchIntelEntry[]): string {
  return [
    `Пошукові запити, які повернули 0 результатів (відсортовано за кількістю):`,
    ...entries.map((e) => `- "${sanitizeTermForPrompt(e.term)}" — ${e.count} разів`),
    ``,
    `Дай рекомендації, що додати чи виправити в каталозі.`,
  ].join('\n');
}

export async function generateSearchInsights(
  entries: SearchIntelEntry[],
  opts?: { provider?: AIProvider },
): Promise<{ text: string; provider: AIProvider }> {
  if (entries.length === 0) {
    return { text: 'Поки немає пошуків без результатів.', provider: 'rules' };
  }
  const provider = opts?.provider;

  if (provider !== 'rules') {
    if (provider === 'gemini' || provider === undefined) {
      const cfg = await getGeminiConfig();
      if (cfg) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
              contents: [{ role: 'user', parts: [{ text: buildPrompt(entries) }] }],
              generationConfig: { temperature: 0.5, maxOutputTokens: 1000 },
            }),
          });
          if (res.ok) {
            const data = (await res.json()) as {
              candidates?: { content?: { parts?: { text?: string }[] } }[];
            };
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (text) return { text, provider: 'gemini' };
          }
        } catch (err) {
          logger.error('[search-intel] Gemini failed', { error: String(err) });
        }
      }
    }
    if (provider === 'claude' || provider === undefined) {
      const key = await getAnthropicKey();
      if (key) {
        try {
          const client = new Anthropic({ apiKey: key });
          const r = await client.messages.create({
            model: 'claude-haiku-4-5',
            max_tokens: 1000,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: buildPrompt(entries) }],
          });
          const t = r.content
            .map((c) => (c.type === 'text' ? c.text : ''))
            .join('')
            .trim();
          if (t) return { text: t, provider: 'claude' };
        } catch (err) {
          logger.error('[search-intel] Claude failed', { error: String(err) });
        }
      }
    }
  }

  // Rules fallback
  const sample = entries
    .slice(0, 5)
    .map((e) => `«${e.term}»`)
    .join(', ');
  return {
    text: `• Топ-запити без результатів: ${sample}.\n• Перевірте чи це варіанти існуючих товарів — додайте синоніми.\n• Якщо реальні товари — додайте у каталог.`,
    provider: 'rules',
  };
}
