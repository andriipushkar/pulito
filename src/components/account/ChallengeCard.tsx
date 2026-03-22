'use client';

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

const TYPE_ICONS: Record<string, string> = {
  order_count: '🛒',
  order_amount: '💰',
  review: '⭐',
  referral: '👥',
  streak: '🔥',
};

export default function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const progress = Math.min(100, Math.round((challenge.currentValue / challenge.target) * 100));

  return (
    <div className={`rounded-xl border p-4 transition-shadow hover:shadow-md ${
      challenge.isCompleted
        ? 'border-green-200 bg-green-50'
        : 'border-[var(--color-border)] bg-white'
    }`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xl">{TYPE_ICONS[challenge.type] || '🎯'}</span>
        <h4 className="font-semibold text-[var(--color-text)]">{challenge.name}</h4>
      </div>

      <p className="mb-3 text-xs text-[var(--color-text-secondary)]">{challenge.description}</p>

      {/* Progress bar */}
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all ${
            challenge.isCompleted ? 'bg-green-500' : 'bg-[var(--color-primary)]'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--color-text-secondary)]">
          {challenge.currentValue} / {challenge.target}
        </span>
        <span className="font-semibold text-amber-600">
          +{challenge.reward} балів
        </span>
      </div>

      {challenge.isCompleted && !challenge.isRewarded && (
        <div className="mt-2 rounded-lg bg-green-100 px-3 py-1.5 text-center text-xs font-semibold text-green-700">
          Виконано! Бонус нараховано.
        </div>
      )}

      {challenge.endDate && !challenge.isCompleted && (
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          До {new Date(challenge.endDate).toLocaleDateString('uk-UA')}
        </p>
      )}
    </div>
  );
}
