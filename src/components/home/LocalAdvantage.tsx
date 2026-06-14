interface LocalAdvantageProps {
  address?: string;
  freeShippingThreshold?: number | null;
}

// Локальна перевага, якої нема в Rozetka/Prom: фізичний магазин і склад у
// Львові. Самовивіз у день замовлення + все реально в наявності — головні
// аргументи проти маркетплейсів, тому стрічка стоїть на головній.
export default function LocalAdvantage({ address, freeShippingThreshold }: LocalAdvantageProps) {
  const cards = [
    {
      title: 'Самовивіз у Львові — сьогодні',
      text: address
        ? `Заберіть замовлення в день оформлення без черг і очікування пошти: ${address}`
        : 'Заберіть замовлення в магазині в день оформлення — без черг і очікування пошти.',
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
          />
        </svg>
      ),
    },
    {
      title: 'Все в наявності на складі',
      text: 'Товари фізично на нашому складі у Львові — не «під замовлення». Що бачите в каталозі, те й відправимо.',
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      ),
    },
    {
      title: 'Швидка відправка по Україні',
      text: `Нова Пошта та Укрпошта — відправляємо в день замовлення${
        freeShippingThreshold ? `, безкоштовно від ${freeShippingThreshold} ₴` : ''
      }.`,
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
          />
        </svg>
      ),
    },
  ];

  return (
    <section aria-label="Наші переваги" className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.title}
          className="flex items-start gap-4 rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] p-5"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            {card.icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">{card.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {card.text}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}
