'use client';

import { useEffect, useState } from 'react';
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
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [streak, setStreak] = useState<Streak | null>(null);

  useEffect(() => {
    fetch('/api/v1/me/loyalty/challenges')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.data) setChallenges(data.data); })
      .catch(() => {});

    fetch('/api/v1/me/loyalty/streak')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.data) setStreak(data.data); })
      .catch(() => {});
  }, []);

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
      {challenges.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-bold text-[var(--color-text)]">Активні челенджі</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {challenges.map((c) => (
              <ChallengeCard key={c.id} challenge={c} />
            ))}
          </div>
        </div>
      )}

      {challenges.length === 0 && !streak && (
        <p className="text-center text-[var(--color-text-secondary)]">
          Наразі немає активних челенджів
        </p>
      )}
    </div>
  );
}
