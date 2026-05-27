import { prisma } from '@/lib/prisma';
import { searchFaq } from '@/services/faq';
import { getSettings } from '@/services/settings';
import { logger } from '@/lib/logger';
import { sanitizeHtml } from '@/utils/sanitize';

/**
 * FAQ chatbot service — answers customer questions in 3 tiers:
 *
 *   1) FAQ lookup (fastest, best match): keyword search on published FAQ items.
 *   2) Product mention: if the query references a product code/name, surface
 *      the matching product card and price.
 *   3) Gemini fallback (optional, when GEMINI_API_KEY configured): pass the
 *      question + relevant FAQ snippets as context for a grounded answer.
 *
 * We never expose raw LLM answers without grounding context — the customer
 * service implications of a hallucinated return policy would be ugly.
 */

export interface ChatSource {
  type: 'faq' | 'product' | 'page' | 'ai';
  title: string;
  snippet?: string;
  url?: string;
}

export interface ChatReply {
  answer: string;
  sources: ChatSource[];
  escalate: boolean;
}

const RETURN_KEYWORDS = ['поверн', 'обмін', 'replac', 'return'];
const DELIVERY_KEYWORDS = ['доставк', 'нова пошта', "кур'єр", 'shipping', 'delivery'];
const PAYMENT_KEYWORDS = ['оплат', 'liqpay', 'monobank', 'payment', 'visa', 'masterc'];

function intent(query: string): 'return' | 'delivery' | 'payment' | 'other' {
  const q = query.toLowerCase();
  if (RETURN_KEYWORDS.some((k) => q.includes(k))) return 'return';
  if (DELIVERY_KEYWORDS.some((k) => q.includes(k))) return 'delivery';
  if (PAYMENT_KEYWORDS.some((k) => q.includes(k))) return 'payment';
  return 'other';
}

/** Strip HTML tags and trim — chatbot replies are plain text. */
function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function findProducts(query: string, limit = 3) {
  const q = query.trim();
  if (q.length < 2) return [];
  return prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, slug: true, code: true, priceRetail: true, quantity: true },
    take: limit,
    orderBy: [{ quantity: 'desc' }, { name: 'asc' }],
  });
}

async function callGemini(question: string, context: string): Promise<string | null> {
  const s = await getSettings().catch(() => null);
  const apiKey = s?.gemini_api_key || process.env.GEMINI_API_KEY || '';
  const model = s?.gemini_model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (!apiKey) return null;

  const prompt = `Ти — асистент магазину побутової хімії Pulito Trade (Львів, https://pulito.trade). Відповідай українською, коротко (2-4 речення), без вигадування. Якщо у наданому контексті немає відповіді — чесно скажи "Я не знаю точно — напишіть менеджеру через форму на сайті".

КОНТЕКСТ:
${context || '(порожньо)'}

ПИТАННЯ КЛІЄНТА:
${question}

ВІДПОВІДЬ:`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      logger.warn('[chatbot] Gemini non-OK', { status: res.status });
      return null;
    }
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || null;
  } catch (err) {
    logger.warn('[chatbot] Gemini failed', {
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function answer(question: string): Promise<ChatReply> {
  const q = question.trim();
  if (q.length < 2) {
    return {
      answer:
        'Напишіть запитання — наприклад: "Як працює доставка Новою поштою?" або "Чи можна повернути товар?"',
      sources: [],
      escalate: false,
    };
  }

  const sources: ChatSource[] = [];

  // Tier 1 — FAQ keyword match
  const faqMatches = await searchFaq(q).catch(() => []);
  const topFaq = faqMatches.slice(0, 3);
  for (const f of topFaq) {
    sources.push({
      type: 'faq',
      title: f.question,
      snippet: plainText(f.answer).slice(0, 220),
      url: `/faq#faq-${f.id}`,
    });
  }

  // Tier 2 — product mention
  const products = await findProducts(q).catch(() => []);
  for (const p of products) {
    sources.push({
      type: 'product',
      title: `${p.name} (${p.code})`,
      snippet: `${Number(p.priceRetail).toFixed(0)} ₴ · ${p.quantity > 0 ? 'у наявності' : 'немає в наявності'}`,
      url: `/product/${p.slug}`,
    });
  }

  // Tier 3 — quick intent shortcuts (deterministic, no LLM)
  const i = intent(q);
  let answerText = '';

  if (topFaq.length > 0) {
    answerText = plainText(topFaq[0].answer).slice(0, 400);
  } else if (i === 'delivery') {
    answerText =
      'Доставляємо Новою поштою (1-2 дні) по всій Україні. Безкоштовно при замовленні від певної суми (див. /delivery-info). Самовивіз у Львові — без оплати доставки.';
  } else if (i === 'return') {
    answerText =
      'Можна повернути товар протягом 14 днів від отримання за умови збереження товарного вигляду. Деталі — на сторінці /returns або зателефонуйте менеджеру.';
  } else if (i === 'payment') {
    answerText =
      'Приймаємо оплату Visa/Mastercard через LiqPay і MonoBank, Apple/Google Pay, накладений платіж Новою поштою.';
  }

  // Tier 4 — Gemini grounded fallback (optional)
  if (!answerText) {
    const context = sources
      .filter((s) => s.snippet)
      .map((s) => `- [${s.type}] ${s.title}: ${s.snippet}`)
      .join('\n');
    const ai = await callGemini(q, context);
    if (ai) {
      answerText = ai;
      sources.push({ type: 'ai', title: 'AI-асистент' });
    }
  }

  // Last resort — escalate to human
  const escalate = !answerText;
  if (escalate) {
    answerText =
      'Я не знайшов прямої відповіді у базі знань. Напишіть менеджеру через форму на /contacts або в Telegram — відповімо протягом години у робочий час.';
  }

  return { answer: sanitizeHtml(answerText), sources, escalate };
}
