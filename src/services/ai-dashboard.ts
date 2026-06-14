/**
 * AI-powered daily executive summary for the admin dashboard.
 *
 * Same provider plumbing as ai-content.ts (Claude / Gemini / rules) — picks
 * up keys from SiteSettings, falls back to env. Output is a 3-5 sentence
 * Ukrainian briefing for the shop owner with concrete numbers and actionable
 * recommendations.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import { getSettings } from '@/services/settings';
import { resolveAIProvider } from '@/services/ai-content';

export type AIDashboardProvider = 'claude' | 'gemini' | 'rules';

export interface DashboardSummaryInput {
  dateLabel: string; // "23 травня 2026"
  orders: {
    todayCount: number;
    todayRevenue: number;
    yesterdayCount: number;
    yesterdayRevenue: number;
    newCount: number;
    unpaidCount: number;
  };
  weeklyRevenue: { date: string; count: number; revenue: number }[];
  users: { total: number; newThisWeek: number; pendingWholesale: number };
  products: {
    total: number;
    outOfStock: number;
    lowStock: number;
    missingBarcode: number;
  };
  topProducts: { name: string; sales: number }[];
  recommendations: { label: string; severity: string; count: number }[];
}

const SYSTEM_PROMPT = `Ти — операційний помічник власника українського інтернет-магазину побутової хімії Pulito Trade. Твоя задача — щодня писати короткий executive-брифінг для власника.

ВИМОГИ:
1. ТІЛЬКИ українська. Природна, не канцелярна.
2. 3-5 речень. Без води, без преамбул "Як ваш помічник".
3. КОЖНЕ речення містить конкретну цифру.
4. Структура: (а) головна цифра дня — замовлення/виручка з порівнянням до вчора; (б) що вимагає уваги ПРЯМО ЗАРАЗ — нові замовлення, неоплачені, out-of-stock; (в) тренд тижня; (г) можливість росту — топ-товар або рекомендація.
5. Тон — діловий, як від CFO, який знає бізнес. Уникай "молодець", "браво", "відмінно".
6. Якщо даних мало (новий магазин — нуль продажів) — пиши коротко і чесно: "Сьогодні без активності, X нових замовлень для опрацювання".
7. Округлюй виручку до цілих сотень/тисяч грн. Не пиши "1234.56 грн" — пиши "1.2 тис грн" або "1 200 грн".
8. Не вигадуй факти яких нема у вхідних даних.

ФОРМАТ: одна короткий параграф плейн-тексту. Без HTML, без markdown, без емодзі, без "•".`;

function buildPrompt(input: DashboardSummaryInput): string {
  const weekTotalCount = input.weeklyRevenue.reduce((s, d) => s + d.count, 0);
  const weekTotalRevenue = input.weeklyRevenue.reduce((s, d) => s + d.revenue, 0);
  return [
    `Дані за ${input.dateLabel}:`,
    ``,
    `ЗАМОВЛЕННЯ`,
    `- Сьогодні: ${input.orders.todayCount} шт на ${input.orders.todayRevenue} грн`,
    `- Вчора: ${input.orders.yesterdayCount} шт на ${input.orders.yesterdayRevenue} грн`,
    `- За тиждень: ${weekTotalCount} шт на ${weekTotalRevenue} грн`,
    `- Чекає опрацювання: ${input.orders.newCount} нових`,
    `- Неоплачені: ${input.orders.unpaidCount}`,
    ``,
    `КЛІЄНТИ`,
    `- Всього: ${input.users.total}`,
    `- Нових за тиждень: ${input.users.newThisWeek}`,
    `- Очікують підтвердження (оптові): ${input.users.pendingWholesale}`,
    ``,
    `ТОВАРИ`,
    `- Активних: ${input.products.total}`,
    `- Закінчилися (out of stock): ${input.products.outOfStock}`,
    `- Майже закінчилися (≤5 шт): ${input.products.lowStock}`,
    `- Без штрихкоду: ${input.products.missingBarcode}`,
    ``,
    `ТОП ТОВАРИ (за 30 днів)`,
    ...input.topProducts.slice(0, 5).map((p, i) => `${i + 1}. ${p.name} — ${p.sales} продажів`),
    ``,
    `ОПЕРАЦІЙНІ РЕКОМЕНДАЦІЇ`,
    ...input.recommendations.slice(0, 8).map((r) => `- [${r.severity}] ${r.label} (${r.count})`),
    ``,
    `Напиши брифінг на 3-5 речень.`,
  ].join('\n');
}

async function getAnthropicKey(): Promise<string | null> {
  try {
    const s = await getSettings();
    if (s.anthropic_api_key) return s.anthropic_api_key;
  } catch {
    /* DB unavailable */
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
    /* DB unavailable */
  }
  if (!apiKey) apiKey = process.env.GEMINI_API_KEY || '';
  if (!model) model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (!apiKey) return null;
  return { apiKey, model };
}

async function summarizeWithClaude(input: DashboardSummaryInput): Promise<string | null> {
  const key = await getAnthropicKey();
  if (!key) return null;
  try {
    const client = new Anthropic({ apiKey: key });
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPrompt(input) }],
    });
    const txt = resp.content
      .map((c) => (c.type === 'text' ? c.text : ''))
      .join('')
      .trim();
    return txt || null;
  } catch (err) {
    logger.error('[ai-dashboard] Claude failed', { error: String(err) });
    return null;
  }
}

// 429/500/503 are transient (quota spikes, "high demand") — worth a short retry
// before falling back to Claude/rules.
const GEMINI_RETRYABLE = new Set([429, 500, 503]);
const GEMINI_MAX_ATTEMPTS = 3;

async function summarizeWithGemini(input: DashboardSummaryInput): Promise<string | null> {
  const cfg = await getGeminiConfig();
  if (!cfg) return null;
  const { apiKey, model } = cfg;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;
    for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: buildPrompt(input) }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 600 },
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        if (GEMINI_RETRYABLE.has(res.status) && attempt < GEMINI_MAX_ATTEMPTS) {
          logger.warn('[ai-dashboard] Gemini transient error, retrying', {
            status: res.status,
            attempt,
          });
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        logger.error('[ai-dashboard] Gemini failed', {
          status: res.status,
          body: body.slice(0, 300),
        });
        return null;
      }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const txt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return txt || null;
    }
    return null;
  } catch (err) {
    logger.error('[ai-dashboard] Gemini threw', { error: String(err) });
    return null;
  }
}

// Rule-based fallback — deterministic Ukrainian summary built from raw stats.
function summarizeWithRules(input: DashboardSummaryInput): string {
  const o = input.orders;
  const diff =
    o.yesterdayCount > 0
      ? Math.round(((o.todayCount - o.yesterdayCount) / o.yesterdayCount) * 100)
      : null;
  const diffPhrase =
    diff === null
      ? ''
      : diff > 0
        ? ` (+${diff}% до вчора)`
        : diff < 0
          ? ` (${diff}% до вчора)`
          : ' (як учора)';

  const parts: string[] = [];
  parts.push(
    `Сьогодні ${o.todayCount} замовлень на ${Math.round(o.todayRevenue)} грн${diffPhrase}.`,
  );

  const urgent: string[] = [];
  if (o.newCount > 0) urgent.push(`${o.newCount} нових на опрацювання`);
  if (o.unpaidCount > 0) urgent.push(`${o.unpaidCount} неоплачених`);
  if (input.products.outOfStock > 0)
    urgent.push(`${input.products.outOfStock} товарів закінчилися`);
  if (input.users.pendingWholesale > 0)
    urgent.push(`${input.users.pendingWholesale} оптових запитів`);
  if (urgent.length) parts.push(`Потребує уваги: ${urgent.join(', ')}.`);

  const weekTotal = input.weeklyRevenue.reduce((s, d) => s + d.revenue, 0);
  if (weekTotal > 0)
    parts.push(`За тиждень виручка ${Math.round(weekTotal).toLocaleString('uk-UA')} грн.`);

  if (input.topProducts.length > 0) {
    const t = input.topProducts[0];
    parts.push(`Топ-товар тижня: «${t.name}» — ${t.sales} продажів.`);
  }

  return parts.join(' ');
}

export async function generateDashboardSummary(
  input: DashboardSummaryInput,
  opts?: { provider?: AIDashboardProvider },
): Promise<{ text: string; provider: AIDashboardProvider }> {
  // Falls back to the site-wide ai_provider setting when no explicit provider
  // is passed (the per-action dropdown was removed).
  const provider = (await resolveAIProvider(opts?.provider)) as AIDashboardProvider | undefined;

  if (provider === 'rules') {
    return { text: summarizeWithRules(input), provider: 'rules' };
  }

  if (provider === 'gemini') {
    const t = await summarizeWithGemini(input);
    if (t) return { text: t, provider: 'gemini' };
    return { text: summarizeWithRules(input), provider: 'rules' };
  }

  if (provider === 'claude') {
    const t = await summarizeWithClaude(input);
    if (t) return { text: t, provider: 'claude' };
    return { text: summarizeWithRules(input), provider: 'rules' };
  }

  // Auto: prefer Gemini (cheap, fast) for routine dashboard summaries
  const fromGemini = await summarizeWithGemini(input);
  if (fromGemini) return { text: fromGemini, provider: 'gemini' };
  const fromClaude = await summarizeWithClaude(input);
  if (fromClaude) return { text: fromClaude, provider: 'claude' };
  return { text: summarizeWithRules(input), provider: 'rules' };
}
