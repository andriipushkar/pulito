'use client';

import { useInView } from '@/hooks/useInView';

interface AnimateOnScrollProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export default function AnimateOnScroll({ children, delay = 0, className = '' }: AnimateOnScrollProps) {
  const [ref, isInView] = useInView();

  return (
    <div
      ref={ref}
      className={`${isInView ? 'animate-fade-in-up' : 'opacity-0'} ${className}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
