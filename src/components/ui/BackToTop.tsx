'use client';

import { useEffect, useRef, useState } from 'react';

export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  const lastScrollY = useRef(0);
  const scrollDirection = useRef<'up' | 'down'>('down');

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY > lastScrollY.current + 10) {
        scrollDirection.current = 'down';
      } else if (currentY < lastScrollY.current - 10) {
        scrollDirection.current = 'up';
      }
      lastScrollY.current = currentY;

      // Show only when scrolled down enough AND scrolling up
      setVisible(currentY > 400 && scrollDirection.current === 'up');
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <button
      onClick={scrollToTop}
      aria-label="Нагору"
      className={`fixed z-40 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow-[var(--shadow-brand)] transition-all hover:bg-[var(--color-primary-dark)] hover:shadow-[var(--shadow-brand-lg)] ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      } bottom-[104px] right-6 lg:bottom-24 lg:right-6`}
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
}
