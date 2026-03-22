'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';

interface CalculatorFormProps {
  onCalculate: (data: { familySize: number; washLoadsPerWeek: number; cleaningFrequency: string }) => void;
  isLoading: boolean;
}

export default function CalculatorForm({ onCalculate, isLoading }: CalculatorFormProps) {
  const [familySize, setFamilySize] = useState(3);
  const [washLoadsPerWeek, setWashLoadsPerWeek] = useState(4);
  const [cleaningFrequency, setCleaningFrequency] = useState('weekly');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCalculate({ familySize, washLoadsPerWeek, cleaningFrequency });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
      <div>
        <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
          Кількість членів сім&apos;ї: <span className="text-[var(--color-primary)]">{familySize}</span>
        </label>
        <input
          type="range"
          min={1}
          max={8}
          value={familySize}
          onChange={(e) => setFamilySize(Number(e.target.value))}
          className="w-full accent-[var(--color-primary)]"
        />
        <div className="mt-1 flex justify-between text-xs text-[var(--color-text-secondary)]">
          <span>1</span><span>4</span><span>8</span>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
          Прань на тиждень: <span className="text-[var(--color-primary)]">{washLoadsPerWeek}</span>
        </label>
        <input
          type="range"
          min={1}
          max={14}
          value={washLoadsPerWeek}
          onChange={(e) => setWashLoadsPerWeek(Number(e.target.value))}
          className="w-full accent-[var(--color-primary)]"
        />
        <div className="mt-1 flex justify-between text-xs text-[var(--color-text-secondary)]">
          <span>1</span><span>7</span><span>14</span>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
          Частота прибирання
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'daily', label: 'Щодня' },
            { value: 'weekly', label: 'Раз на тиждень' },
            { value: 'biweekly', label: 'Раз на 2 тижні' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCleaningFrequency(opt.value)}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                cleaningFrequency === opt.value
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)] text-[var(--color-primary)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-light)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Розраховую...' : 'Розрахувати'}
      </Button>
    </form>
  );
}
