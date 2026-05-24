import FaqJsonLd from '@/components/faq/FaqJsonLd';

/**
 * Extracts a FAQ section from a product's fullDescription HTML and renders
 * schema.org/FAQPage structured data so Google can index Q&A pairs and show
 * them as "People Also Ask" rich snippets.
 *
 * Expected source markup (produced by the AI generator's SYSTEM_PROMPT):
 *   <h3>Питання та відповіді</h3>
 *   <p><strong>Question?</strong> Answer text.</p>
 *   <p><strong>Question 2?</strong> Answer 2.</p>
 *   ... up to the next <h3> or end of string.
 *
 * Falls back silently (renders nothing) if no FAQ block is found — older
 * products without an LLM-generated FAQ shouldn't pay any rendering cost.
 */

interface ProductFaqJsonLdProps {
  fullDescription: string | null | undefined;
}

const FAQ_HEADING_RE = /<h3[^>]*>\s*Питання\s+та\s+відповіді\s*<\/h3>/i;
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
  const headingMatch = fullDescription.match(FAQ_HEADING_RE);
  if (!headingMatch || headingMatch.index === undefined) return [];

  // Bound the FAQ block: from after the heading up to the next <h2>/<h3> or EOF.
  const start = headingMatch.index + headingMatch[0].length;
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
