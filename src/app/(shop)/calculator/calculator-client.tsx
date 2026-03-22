'use client';

import { useState } from 'react';
import CalculatorForm from '@/components/calculator/CalculatorForm';
import CalculatorResults from '@/components/calculator/CalculatorResults';

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

interface Result {
  recommendations: Recommendation[];
  totalMonthly: number;
  totalQuarterly: number;
}

export default function CalculatorClient() {
  const [result, setResult] = useState<Result | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCalculate = async (data: { familySize: number; washLoadsPerWeek: number; cleaningFrequency: string }) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        familySize: data.familySize.toString(),
        washLoadsPerWeek: data.washLoadsPerWeek.toString(),
        cleaningFrequency: data.cleaningFrequency,
      });
      const res = await fetch(`/api/v1/calculator?${params}`);
      if (res.ok) {
        const json = await res.json();
        setResult(json.data);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = async (productId: number, quantity: number) => {
    try {
      await fetch('/api/v1/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity }),
      });
    } catch {
      // silently fail
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CalculatorForm onCalculate={handleCalculate} isLoading={isLoading} />

      {result && (
        <CalculatorResults
          recommendations={result.recommendations}
          totalMonthly={result.totalMonthly}
          totalQuarterly={result.totalQuarterly}
          onAddToCart={handleAddToCart}
        />
      )}
    </div>
  );
}
