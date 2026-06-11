import FaqJsonLd from '@/components/faq/FaqJsonLd';

/**
 * Extracts a FAQ section from a product's fullDescription HTML and renders
 * schema.org/FAQPage structured data so Google can index Q&A pairs and show
 * them as "People Also Ask" rich snippets.
 *
 * Expected source markup (produced by the AI generator's SYSTEM_PROMPT):
 *   <h3>Питання та відповіді</h3>   (any h2/h3 mentioning «питання» or "FAQ")
 *   <p><strong>Question?</strong> Answer text.</p>
 *   <p><strong>Question 2?</strong> Answer 2.</p>
 *   ... up to the next <h2>/<h3> or end of string.
 *
 * Falls back silently (renders nothing) if no FAQ block is found — older
 * products without an LLM-generated FAQ shouldn't pay any rendering cost.
 */

interface ProductFaqJsonLdProps {
  fullDescription: string | null | undefined;
}

// Any h2/h3 heading; the FAQ one is recognised by its text, not exact wording —
// hand-written descriptions use «Часті питання», «Поширені питання», "FAQ" etc.
const HEADING_RE = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;
const FAQ_TITLE_RE = /питання|faq/i;
// Each FAQ entry: <p><strong>Q?</strong> A.</p>. Tolerate <b> as a synonym
// of <strong> and any leading/trailing whitespace.
const QA_RE = /<p[^>]*>\s*<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>\s*([\s\S]*?)<\/p>/gi;

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractFaqItems(fullDescription: string): { question: string; answer: string }[] {
  let start = -1;
  for (const m of fullDescription.matchAll(HEADING_RE)) {
    if (FAQ_TITLE_RE.test(stripTags(m[2] || ''))) {
      start = (m.index ?? 0) + m[0].length;
      break;
    }
  }
  if (start === -1) return [];

  // Bound the FAQ block: from after the heading up to the next <h2>/<h3> or EOF.
  const tail = fullDescription.slice(start);
  const nextHeadingIdx = tail.search(/<h[23][^>]*>/i);
  const block = nextHeadingIdx === -1 ? tail : tail.slice(0, nextHeadingIdx);

  const items: { question: string; answer: string }[] = [];
  for (const m of block.matchAll(QA_RE)) {
    const question = stripTags(m[1] || '');
    const answer = stripTags(m[2] || '');
    if (question && answer) items.push({ question, answer });
  }
  return items;
}

export default function ProductFaqJsonLd({ fullDescription }: ProductFaqJsonLdProps) {
  if (!fullDescription) return null;
  const items = extractFaqItems(fullDescription);
  if (items.length === 0) return null;
  return <FaqJsonLd items={items} />;
}
