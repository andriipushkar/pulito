'use client';

import { useEffect, useState } from 'react';

type Schedule = Array<{ open: number; close: number } | null>;

// Index 0 = Sunday, 1 = Monday, ..., 6 = Saturday (matches Date#getDay).
// Hours are in 24h minutes since midnight (Europe/Kyiv).
const DEFAULT_SCHEDULE: Schedule = [
  null, // Sun
  { open: 9 * 60, close: 18 * 60 }, // Mon
  { open: 9 * 60, close: 18 * 60 },
  { open: 9 * 60, close: 18 * 60 },
  { open: 9 * 60, close: 18 * 60 },
  { open: 9 * 60, close: 18 * 60 }, // Fri
  { open: 10 * 60, close: 15 * 60 }, // Sat
];

const WEEKDAY_LABELS = ['неділю', 'понеділок', 'вівторок', 'середу', 'четвер', 'пʼятницю', 'суботу'];

function getKyivParts(): { dayOfWeek: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { dayOfWeek: map[weekday] ?? 1, minutes: hour * 60 + minute };
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function findNextOpening(
  schedule: Schedule,
  fromDay: number,
  fromMinutes: number,
): { day: number; minutes: number } | null {
  for (let i = 0; i < 7; i++) {
    const day = (fromDay + i) % 7;
    const slot = schedule[day];
    if (!slot) continue;
    if (i === 0 && fromMinutes < slot.open) return { day, minutes: slot.open };
    if (i > 0) return { day, minutes: slot.open };
  }
  return null;
}

export default function OpenStatus({ schedule = DEFAULT_SCHEDULE }: { schedule?: Schedule }) {
  const [now, setNow] = useState<{ dayOfWeek: number; minutes: number } | null>(null);

  useEffect(() => {
    setNow(getKyivParts());
    const id = setInterval(() => setNow(getKyivParts()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return <span className="inline-flex h-4 w-24 animate-pulse rounded bg-white/10" />;
  }

  const today = schedule[now.dayOfWeek];
  const isOpen = today && now.minutes >= today.open && now.minutes < today.close;

  if (isOpen) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="font-medium text-emerald-300">Зараз відчинено</span>
        <span className="text-white/50">· до {formatMinutes(today!.close)}</span>
      </span>
    );
  }

  const next = findNextOpening(schedule, now.dayOfWeek, now.minutes);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="h-2 w-2 rounded-full bg-rose-400" />
      <span className="font-medium text-rose-300">Зачинено</span>
      {next && (
        <span className="text-white/50">
          · відчинимо {next.day === now.dayOfWeek ? 'сьогодні' : `у ${WEEKDAY_LABELS[next.day]}`} о{' '}
          {formatMinutes(next.minutes)}
        </span>
      )}
    </span>
  );
}
