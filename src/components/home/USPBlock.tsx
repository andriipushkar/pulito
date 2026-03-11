'use client';

import { useEffect, useRef, useState } from 'react';

interface USPItem {
  icon: string;
  title: string;
  description: string;
}

const defaultItems: USPItem[] = [
  {
    icon: 'truck',
    title: 'Швидка доставка',
    description: 'По всій Україні за 1-3 дні',
  },
  {
    icon: 'shield',
    title: 'Гарантія якості',
    description: 'Тільки оригінальна продукція',
  },
  {
    icon: 'money',
    title: 'Оптові ціни',
    description: 'Знижки для оптових покупців',
  },
  {
    icon: 'phone',
    title: 'Підтримка',
    description: 'Консультація Пн-Пт 9-18',
  },
];

const iconStyles = [
  { bg: 'from-sky-100 to-sky-50', text: 'text-sky-500' },
  { bg: 'from-emerald-100 to-emerald-50', text: 'text-emerald-500' },
  { bg: 'from-amber-100 to-amber-50', text: 'text-amber-500' },
  { bg: 'from-violet-100 to-violet-50', text: 'text-violet-500' },
];

function USPIcon({ name, colorClass }: { name: string; colorClass: string }) {
  const cls = `h-6 w-6 sm:h-8 sm:w-8 ${colorClass}`;
  switch (name) {
    case 'truck':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
        </svg>
      );
    case 'shield':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      );
    case 'money':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      );
    case 'phone':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
        </svg>
      );
    default:
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      );
  }
}

interface USPBlockProps {
  items?: USPItem[];
}

export default function USPBlock({ items }: USPBlockProps) {
  const usps = items && items.length > 0 ? items : defaultItems;
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="mt-2 py-2 lg:hidden">
      {/* Mobile: horizontal scroll */}
      <div className="-mx-4 px-4 sm:hidden">
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
          {usps.map((usp, i) => {
            const style = iconStyles[i % iconStyles.length];
            return (
              <div
                key={i}
                className={`flex w-[140px] shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-white/60 bg-white/80 p-3 text-center shadow-[var(--shadow)] backdrop-blur-sm transition-all duration-500 ease-out active:scale-[0.97] ${
                  visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                }`}
                style={{ transitionDelay: visible ? `${i * 80}ms` : '0ms' }}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${style.bg}`}>
                  <USPIcon name={usp.icon} colorClass={style.text} />
                </div>
                <div>
                  <h3 className="text-[12px] font-bold leading-snug text-[var(--color-text)]">
                    {usp.title}
                  </h3>
                  <p className="mt-0.5 text-[10px] leading-tight text-[var(--color-text-secondary)]">
                    {usp.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tablet: grid 2x2 (visible sm-lg, hidden on lg+) */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {usps.map((usp, i) => {
            const style = iconStyles[i % iconStyles.length];
            return (
              <div
                key={i}
                className={`flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)]/50 bg-white p-4 text-center shadow-[var(--shadow)] transition-all duration-500 ease-out hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 ${
                  visible
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-4 opacity-0'
                }`}
                style={{ transitionDelay: visible ? `${i * 100}ms` : '0ms' }}
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${style.bg}`}
                >
                  <USPIcon name={usp.icon} colorClass={style.text} />
                </div>
                <div>
                  <h3 className="text-[13px] font-bold leading-snug text-[var(--color-text)]">
                    {usp.title}
                  </h3>
                  <p className="mt-0.5 text-[11px] leading-tight text-[var(--color-text-secondary)]">
                    {usp.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
