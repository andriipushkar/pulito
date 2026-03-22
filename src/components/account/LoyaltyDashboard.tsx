'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import ChallengeCard from './ChallengeCard';

interface Challenge {
  id: number;
  name: string;
  description: string;
  type: string;
  target: number;
  reward: number;
  currentValue: number;
  isCompleted: boolean;
  isRewarded: boolean;
  endDate: string | null;
}

interface Streak {
  currentStreak: number;
  longestStreak: number;
  lastOrderDate: string | null;
}

export default function LoyaltyDashboard() {
  const { data: challenges } = useSWR<Challenge[]>('/api/v1/me/loyalty/challenges', fetcher);
  const { data: streak } = useSWR<Streak>('/api/v1/me/loyalty/streak', fetcher);

  return (
    <div className="space-y-6">
      {/* Streak Section */}
      {streak && (
        <div className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-white">
          <h3 className="text-lg font-bold">Серія покупок</h3>
          <div className="mt-3 flex items-center gap-8">
            <div>
              <p className="text-3xl font-extrabold">{streak.currentStreak}</p>
              <p className="text-sm opacity-80">Поточна серія</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold">{streak.longestStreak}</p>
              <p className="text-sm opacity-80">Рекорд</p>
            </div>
            {streak.lastOrderDate && (
              <div>
                <p className="text-sm opacity-80">Останнє замовлення</p>
                <p className="text-sm font-semibold">
                  {new Date(streak.lastOrderDate).toLocaleDateString('uk-UA')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Challenges Section */}
      {challenges && challenges.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-bold text-[var(--color-text)]">Активні челенджі</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {challenges.map((c) => (
              <ChallengeCard key={c.id} challenge={c} />
            ))}
          </div>
        </div>
      )}

      {(!challenges || challenges.length === 0) && !streak && (
        <p className="text-center text-[var(--color-text-secondary)]">
          Наразі немає активних челенджів
        </p>
      )}
    </div>
  );
}
