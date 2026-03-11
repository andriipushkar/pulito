'use client';

import { useState, type ReactNode } from 'react';
import Tabs from '@/components/ui/Tabs';
import Accordion, { AccordionItem } from '@/components/ui/Accordion';
import FaqSearch from './FaqSearch';
import { sanitizeHtml } from '@/utils/sanitize';

interface FaqItem {
  id: number;
  question: string;
  answer: string;
  category: string;
}

interface FaqContentProps {
  groupedFaq: Record<string, FaqItem[]>;
}

function highlightText(text: string, query: string): string {
  if (!query || query.length < 2) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

export default function FaqContent({ groupedFaq }: FaqContentProps) {
  const [searchResults, setSearchResults] = useState<FaqItem[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const categories = Object.keys(groupedFaq);

  const handleClick = (id: number) => {
    fetch(`/api/v1/faq/${id}/click`, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' } }).catch(() => {});
  };

  const renderFaqList = (items: FaqItem[], query?: string) => (
    <Accordion>
      {items.map((item) => {
        const title = query
          ? <span dangerouslySetInnerHTML={{ __html: highlightText(item.question, query) }} />
          : item.question;
        const answerHtml = query
          ? highlightText(sanitizeHtml(item.answer), query)
          : sanitizeHtml(item.answer);

        return (
          <AccordionItem key={item.id} title={title}>
            <div
              className="prose max-w-none text-sm text-[var(--color-text-secondary)]"
              onClick={() => handleClick(item.id)}
              dangerouslySetInnerHTML={{ __html: answerHtml }}
            />
          </AccordionItem>
        );
      })}
    </Accordion>
  );

  const tabs = categories.map((cat) => ({
    id: cat,
    label: cat,
    content: renderFaqList(groupedFaq[cat]) as ReactNode,
  }));

  return (
    <div>
      <FaqSearch onResults={setSearchResults} onQueryChange={setSearchQuery} />

      <div className="mt-6">
        {searchResults !== null ? (
          searchResults.length > 0 ? (
            renderFaqList(searchResults, searchQuery)
          ) : (
            <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
              Нічого не знайдено
            </p>
          )
        ) : tabs.length > 0 ? (
          <Tabs tabs={tabs} />
        ) : (
          <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
            Поки що немає питань
          </p>
        )}
      </div>

      {/* "Не знайшли відповідь?" block */}
      <div className="mt-10 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 text-center">
        <h3 className="mb-2 text-lg font-semibold">Не знайшли відповідь?</h3>
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          Задайте своє питання напряму — ми з радістю допоможемо!
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="https://t.me/poroshok_shop"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-[#26A5E4] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
            Telegram
          </a>
          <a
            href="viber://pa?chatURI=poroshok_shop"
            className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-[#7360F2] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.4 0C9.473.028 5.34.39 3.07 2.456.543 4.78.1 8.235.035 12.476c-.065 4.24-.15 12.191 7.453 14.344h.007l-.005 3.27s-.048.878.546 1.056c.655.209 1.088-.258 2.382-1.737.71-.811 1.688-2.002 2.428-2.912 6.693.563 11.838-1.794 12.418-2.018.674-.26 4.487-1.408 5.108-5.752.641-4.478-.26-10.323-1.643-12.413C27.34 4.508 23.395.498 16.353.068 15.702.028 12.895-.016 11.4 0zm.392 2.084c1.314-.025 3.89-.01 4.452.025 5.959.363 9.32 3.619 10.533 5.39 1.162 1.758 1.922 6.904 1.382 10.702-.496 3.47-3.571 4.323-4.133 4.54-.485.186-4.859 2.147-10.571 1.712 0 0-4.19 5.056-5.497 6.39-.203.208-.442.286-.601.245-.222-.058-.283-.267-.278-.592l.035-6.93c-6.423-1.824-6.037-8.455-5.983-12.068.054-3.613.44-6.534 2.56-8.59C5.614 1.553 9.28 2.08 11.792 2.084zM11.52 5.2h-.064c-.88.02-4.204.525-4.76 3.084-.356 1.49.28 2.424.72 2.556.678.203 1.19-.475 1.34-1.174.157-.726.373-1.024.832-1.35.397-.28 1.47-.428 2.453-.163.756.204 1.167.591 1.308 1.124.188.712.15 1.455.05 2.074-.147.908-.747 1.52-1.425 2.145-.35.324-.717.598-.98.942-.445.582-.326 1.218-.095 1.881.476 1.37 1.314 2.458 2.424 3.324.583.455 1.253.794 1.876 1.191.571.365 1.07.61 1.703.335.538-.235.864-.815.83-1.5-.016-.327-.295-.614-.566-.816-.276-.206-.597-.366-.872-.577-.42-.322-.782-.657-.782-.657-.373-.315-.446-.75-.152-1.157l.012-.016c.366-.502.751-.976 1.168-1.427.233-.252.542-.445.785-.695.39-.403.482-.943.189-1.451-.528-.917-1.082-1.82-1.73-2.655-.268-.346-.664-.52-1.1-.45-.488.08-.788.455-.93.88-.048.143-.085.29-.122.435-.148.582-.518.726-1.023.48-1.12-.548-1.85-1.498-2.398-2.583-.212-.42-.095-.77.364-.906.146-.044.283-.1.435-.126.43-.072.61-.353.55-.806-.058-.436-.277-.832-.47-1.218-.24-.487-.622-.816-1.158-.928A2.28 2.28 0 0011.52 5.2z"/></svg>
            Viber
          </a>
          <a
            href="tel:+380001234567"
            className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] px-5 py-2.5 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg)]"
          >
            Зателефонувати
          </a>
        </div>
      </div>
    </div>
  );
}
