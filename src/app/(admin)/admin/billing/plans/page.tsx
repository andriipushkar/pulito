'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';

interface Plan {
  id: number;
  name: string;
  slug: string;
  priceMonthly: number;
  priceYearly: number;
  features: Record<string, unknown>;
  maxProducts: number;
  maxOrders: number;
}

export default function AdminPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [changingPlanId, setChangingPlanId] = useState<number | null>(null);

  useEffect(() => {
    apiClient
      .get<Plan[]>('/api/v1/admin/plans')
      .then((res) => {
        if (res.success && res.data) {
          setPlans(res.data);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSelectPlan = async (planId: number) => {
    setChangingPlanId(planId);
    const res = await apiClient.post('/api/v1/admin/billing/change-plan', { planId });
    setChangingPlanId(null);

    if (res.success) {
      toast.success('План змінено');
      router.push('/admin/billing');
    } else {
      toast.error(res.error || 'Помилка зміни плану');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold">Тарифні плани</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Оберіть план, що найкраще підходить для вашого бізнесу.
        </p>
      </div>

      {plans.length === 0 ? (
        <p className="text-[var(--color-text-secondary)]">Плани ще не налаштовано.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="flex flex-col rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6"
            >
              <h3 className="mb-2 text-lg font-semibold">{plan.name}</h3>

              <div className="mb-4">
                <span className="text-2xl font-bold">{plan.priceMonthly}</span>
                <span className="text-sm text-[var(--color-text-secondary)]"> грн/міс</span>
              </div>

              <div className="mb-4 text-sm text-[var(--color-text-secondary)]">
                або {plan.priceYearly} грн/рік
              </div>

              <div className="mb-6 flex-1 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-green-500">&#10003;</span>
                  <span>До {plan.maxProducts} товарів</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">&#10003;</span>
                  <span>До {plan.maxOrders} замовлень/міс</span>
                </div>
                {plan.features &&
                  typeof plan.features === 'object' &&
                  Object.entries(plan.features).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-green-500">&#10003;</span>
                      <span>
                        {key}: {String(value)}
                      </span>
                    </div>
                  ))}
              </div>

              <Button
                onClick={() => handleSelectPlan(plan.id)}
                isLoading={changingPlanId === plan.id}
                className="w-full"
              >
                Обрати план
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
