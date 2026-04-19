'use client';

import { useState, useCallback } from 'react';
import CalculatorForm from '@/components/calculator/CalculatorForm';
import RoomSelector, { type RoomConfig } from '@/components/calculator/RoomSelector';
import CalculatorResults from '@/components/calculator/CalculatorResults';
import Button from '@/components/ui/Button';

interface Recommendation {
  productId: number;
  name: string;
  slug: string;
  imagePath: string | null;
  priceRetail: number;
  quantityPerMonth: number;
  totalCost: number;
  category: string;
}

interface RoomResultData {
  roomType: string;
  roomLabel: string;
  count: number;
  area: number;
  products: Recommendation[];
  monthlyCost: number;
}

interface LegacyResult {
  recommendations: Recommendation[];
  totalMonthly: number;
  totalQuarterly: number;
}

interface RoomResult {
  rooms: RoomResultData[];
  totalMonthly: number;
}

type Step = 1 | 2 | 3;

export default function CalculatorClient() {
  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1 data
  const [householdData, setHouseholdData] = useState<{
    familySize: number;
    washLoadsPerWeek: number;
    cleaningFrequency: string;
  } | null>(null);

  // Step 2 data
  const [rooms, setRooms] = useState<RoomConfig[]>([]);

  // Step 3 results
  const [legacyResult, setLegacyResult] = useState<LegacyResult | null>(null);
  const [roomResult, setRoomResult] = useState<RoomResult | null>(null);

  const handleHouseholdSubmit = useCallback(
    (data: { familySize: number; washLoadsPerWeek: number; cleaningFrequency: string }) => {
      setHouseholdData(data);
      setStep(2);
    },
    [],
  );

  const handleCalculate = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch legacy household-based results
      if (householdData) {
        const params = new URLSearchParams({
          familySize: householdData.familySize.toString(),
          washLoadsPerWeek: householdData.washLoadsPerWeek.toString(),
          cleaningFrequency: householdData.cleaningFrequency,
        });
        const res = await fetch(`/api/v1/calculator?${params}`);
        if (res.ok) {
          const json = await res.json();
          setLegacyResult(json.data);
        }
      }

      // Fetch room-based results if rooms selected
      if (rooms.length > 0) {
        const res = await fetch('/api/v1/calculator', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ rooms }),
        });
        if (res.ok) {
          const json = await res.json();
          setRoomResult(json.data);
        }
      }

      setStep(3);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [householdData, rooms]);

  const handleAddToCart = useCallback(async (productId: number, quantity: number) => {
    try {
      await fetch('/api/v1/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity }),
      });
    } catch {
      // silently fail
    }
  }, []);

  const handleAddAllToCart = useCallback(async () => {
    const allProducts: { productId: number; quantity: number }[] = [];

    if (roomResult) {
      for (const room of roomResult.rooms) {
        for (const p of room.products) {
          allProducts.push({ productId: p.productId, quantity: p.quantityPerMonth });
        }
      }
    } else if (legacyResult) {
      for (const p of legacyResult.recommendations) {
        allProducts.push({ productId: p.productId, quantity: p.quantityPerMonth });
      }
    }

    for (const item of allProducts) {
      await handleAddToCart(item.productId, item.quantity);
    }
  }, [roomResult, legacyResult, handleAddToCart]);

  // Determine total monthly for display
  const totalMonthly = roomResult
    ? roomResult.totalMonthly + (legacyResult?.totalMonthly ?? 0)
    : (legacyResult?.totalMonthly ?? 0);

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              data-testid={`step-indicator-${s}`}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                s === step
                  ? 'bg-[var(--color-primary)] text-white'
                  : s < step
                    ? 'bg-[var(--color-primary-50)] text-[var(--color-primary)]'
                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={`h-0.5 w-8 ${s < step ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Household info */}
      {step === 1 && (
        <div data-testid="step-1">
          <h2 className="mb-4 text-lg font-bold text-[var(--color-text)]">
            Крок 1: Інформація про домогосподарство
          </h2>
          <CalculatorForm onCalculate={handleHouseholdSubmit} isLoading={false} />
        </div>
      )}

      {/* Step 2: Room selection */}
      {step === 2 && (
        <div data-testid="step-2">
          <h2 className="mb-4 text-lg font-bold text-[var(--color-text)]">
            Крок 2: Оберіть кімнати
          </h2>
          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
            <RoomSelector rooms={rooms} onChange={setRooms} />
          </div>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>
              Назад
            </Button>
            <Button
              onClick={handleCalculate}
              disabled={isLoading}
              isLoading={isLoading}
              className="flex-1"
            >
              {isLoading ? 'Розраховую...' : 'Розрахувати'}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && (
        <div data-testid="step-3">
          <h2 className="mb-4 text-lg font-bold text-[var(--color-text)]">Крок 3: Результати</h2>
          <CalculatorResults
            recommendations={legacyResult?.recommendations}
            roomResults={roomResult?.rooms}
            totalMonthly={totalMonthly}
            totalQuarterly={legacyResult?.totalQuarterly}
            onAddToCart={handleAddToCart}
            onAddAllToCart={handleAddAllToCart}
          />
          <div className="mt-4">
            <Button variant="outline" onClick={() => setStep(2)}>
              Назад
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
