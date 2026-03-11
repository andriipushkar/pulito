import Tabs from '@/components/ui/Tabs';
import type { ProductContent } from '@/types/product';
import { sanitizeHtml } from '@/utils/sanitize';

interface ProductTabsProps {
  content: ProductContent | null;
}

export default function ProductTabs({ content }: ProductTabsProps) {
  const tabs = [];

  if (content?.fullDescription) {
    tabs.push({
      id: 'description',
      label: 'Опис',
      content: (
        <div
          className="prose max-w-none leading-relaxed"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(content.fullDescription) }}
        />
      ),
    });
  }

  if (content?.specifications) {
    tabs.push({
      id: 'specs',
      label: 'Характеристики',
      content: (
        <div
          className="prose max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(content.specifications) }}
        />
      ),
    });
  }

  tabs.push({
    id: 'delivery',
    label: 'Доставка та оплата',
    content: (
      <div className="space-y-4 text-sm text-[var(--color-text-secondary)]">
        <div>
          <h4 className="mb-2 font-semibold text-[var(--color-text)]">Доставка</h4>
          <ul className="list-disc space-y-1 pl-5">
            <li>Нова Пошта — 1-3 робочі дні</li>
            <li>Укрпошта — 3-7 робочих днів</li>
            <li>Самовивіз зі складу</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-2 font-semibold text-[var(--color-text)]">Оплата</h4>
          <ul className="list-disc space-y-1 pl-5">
            <li>Накладений платіж</li>
            <li>Оплата на картку</li>
            <li>Безготівковий розрахунок (для юридичних осіб)</li>
          </ul>
        </div>
      </div>
    ),
  });

  if (tabs.length === 0) return null;

  return <Tabs tabs={tabs} />;
}
