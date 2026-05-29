import { NextRequest } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { withRole } from '@/middleware/auth';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/services/settings';
import { resolveAIProvider } from '@/services/ai-content';
import { successResponse, errorResponse } from '@/utils/api-response';
import { logger } from '@/lib/logger';

const schema = z.object({
  provider: z.enum(['claude', 'gemini', 'rules']).optional(),
});

const SYSTEM_PROMPT = `Ти — менеджер інтернет-магазину побутової хімії Pulito Trade, який відповідає на відгуки клієнтів. Твоя задача — написати ВВІЧЛИВУ професійну відповідь українською на конкретний відгук.

ВИМОГИ:
- Природна українська, без канцеляризмів.
- Подякуй за відгук (1 речення).
- Якщо відгук позитивний (4-5 зірок) — щиро подякуй і запроси на нові покупки.
- Якщо негативний (1-2 зірки) — щиро вибач, запропонуй конкретну допомогу (контакт, обмін, повернення), не виправдовуйся.
- Якщо середній (3 зірки) — подякуй за чесний відгук, спитай як можна покращити.
- Згадай конкретний фрагмент відгуку (показує що ти його прочитав).
- 2-4 речення, не більше 500 символів.
- Без емодзі, без HTML.
- Підпис: "Команда Pulito Trade".

Поверни ТІЛЬКИ текст відповіді без префіксів типу "Reply:".`;

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

interface ReplyContext {
  rating: number;
  title: string | null;
  comment: string | null;
  pros: string | null;
  cons: string | null;
  productName: string;
}

function buildPrompt(ctx: ReplyContext): string {
  return [
    `Товар: ${ctx.productName}`,
    `Рейтинг: ${ctx.rating}/5`,
    ctx.title ? `Заголовок: ${ctx.title}` : null,
    ctx.comment ? `Коментар: ${ctx.comment}` : null,
    ctx.pros ? `Переваги: ${ctx.pros}` : null,
    ctx.cons ? `Недоліки: ${ctx.cons}` : null,
    ``,
    `Напиши відповідь.`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function genWithGemini(ctx: ReplyContext): Promise<string | null> {
  const cfg = await getGeminiConfig();
  if (!cfg) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: buildPrompt(ctx) }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 500 },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (err) {
    logger.error('[admin/reviews/ai-draft] Gemini failed', { error: String(err) });
    return null;
  }
}

async function genWithClaude(ctx: ReplyContext): Promise<string | null> {
  const key = await getAnthropicKey();
  if (!key) return null;
  try {
    const client = new Anthropic({ apiKey: key });
    const r = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPrompt(ctx) }],
    });
    return (
      r.content
        .map((c) => (c.type === 'text' ? c.text : ''))
        .join('')
        .trim() || null
    );
  } catch (err) {
    logger.error('[admin/reviews/ai-draft] Claude failed', { error: String(err) });
    return null;
  }
}

function genWithRules(ctx: ReplyContext): string {
  if (ctx.rating >= 4) {
    return `Дякуємо за такий теплий відгук про «${ctx.productName}»! Раді що товар підійшов. Чекаємо на наступні замовлення.\n\nКоманда Pulito Trade`;
  }
  if (ctx.rating <= 2) {
    return `Дуже шкода, що товар «${ctx.productName}» не виправдав очікувань. Будь ласка, напишіть нам на info@pulito.trade — розглянемо ситуацію і запропонуємо рішення.\n\nКоманда Pulito Trade`;
  }
  return `Дякуємо за чесний відгук про «${ctx.productName}». Раді почути ваше враження. Будемо вдячні за деталі — як ми можемо покращити сервіс?\n\nКоманда Pulito Trade`;
}

export const POST = withRole(
  'admin',
  'manager',
)(async (request: NextRequest, { params }) => {
  try {
    const { id } = await params!;
    const numId = Number(id);
    if (isNaN(numId)) return errorResponse('Невалідний ID', 400);

    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    // Per-action provider dropdown removed — fall back to the site-wide setting.
    const provider = await resolveAIProvider(parsed.success ? parsed.data.provider : undefined);

    const review = await prisma.review.findUnique({
      where: { id: numId },
      select: {
        rating: true,
        title: true,
        comment: true,
        pros: true,
        cons: true,
        product: { select: { name: true } },
      },
    });
    if (!review) return errorResponse('Відгук не знайдено', 404);

    const ctx: ReplyContext = {
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      pros: review.pros,
      cons: review.cons,
      productName: review.product.name,
    };

    let text: string | null = null;
    let used: 'claude' | 'gemini' | 'rules' = 'rules';
    if (provider === 'rules') {
      text = genWithRules(ctx);
    } else if (provider === 'gemini') {
      text = await genWithGemini(ctx);
      used = text ? 'gemini' : 'rules';
      if (!text) text = genWithRules(ctx);
    } else if (provider === 'claude') {
      text = await genWithClaude(ctx);
      used = text ? 'claude' : 'rules';
      if (!text) text = genWithRules(ctx);
    } else {
      text = await genWithGemini(ctx);
      if (text) used = 'gemini';
      else {
        text = await genWithClaude(ctx);
        if (text) used = 'claude';
        else text = genWithRules(ctx);
      }
    }

    // Persist as suggested draft so admin can revisit without re-spending tokens.
    await prisma.review.update({
      where: { id: numId },
      data: { aiSuggestedReply: text },
    });

    return successResponse({ text, provider: used });
  } catch (err) {
    logger.error('[admin/reviews/ai-draft] failed', { error: err });
    return errorResponse('Не вдалося згенерувати чернетку', 500);
  }
});
