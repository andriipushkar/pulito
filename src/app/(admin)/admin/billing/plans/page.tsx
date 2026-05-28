'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
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

interface CurrentBillingSummary {
  planId: number;
  plan: { name: string; maxProducts: number; maxOrders: number };
}

interface UsageSummary {
  products: { used: number; max: number };
  orders: { used: number; max: number };
}

export default function AdminPlansPage() {
  const t = useTranslations('admin.billingPlansPage');
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [current, setCurrent] = useState<CurrentBillingSummary | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [changingPlanId, setChangingPlanId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiClient.get<Plan[]>('/api/v1/admin/plans'),
      apiClient.get<{ billing: CurrentBillingSummary; usage: UsageSummary }>(
        '/api/v1/admin/billing',
      ),
    ])
      .then(([plansRes, billingRes]) => {
        if (cancelled) return;
        if (plansRes.success && plansRes.data) setPlans(plansRes.data);
        else toast.error(plansRes.error || t('loadPlansError'));
        if (billingRes.success && billingRes.data) {
          setCurrent(billingRes.data.billing);
          setUsage(billingRes.data.usage);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error(t('loadError'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectPlan = async (planId: number) => {
    const target = plans.find((p) => p.id === planId);
    if (!target) return;

    // Downgrade-protection: if the target plan caps below current usage, the
    // tenant will land in a "valid in name but invariant-violated" state
    // (more products than the new limit allows). Surface the consequences
    // explicitly and require an extra confirm.
    if (usage) {
      const productsOverflow = usage.products.used > target.maxProducts;
      const ordersOverflow = usage.orders.used > target.maxOrders;
      if (productsOverflow || ordersOverflow) {
        const lines: string[] = [];
        if (productsOverflow) {
          lines.push(
            t('overflowProducts', { used: usage.products.used, limit: target.maxProducts }),
          );
        }
        if (ordersOverflow) {
          lines.push(t('overflowOrders', { used: usage.orders.used, limit: target.maxOrders }));
        }
        const ok = window.confirm(
          t('overflowConfirm', { name: target.name, details: lines.join('\n\n') }),
        );
        if (!ok) return;
      } else if (current && current.planId !== planId) {
        // Не-overflow downgrade теж варто підтвердити, бо biller часто
        // спишеться full month за новий план — proration не імплементовано.
        const ok = window.confirm(t('confirmChange', { from: current.plan.name, to: target.name }));
        if (!ok) return;
      }
    }

    setChangingPlanId(planId);
    try {
      const res = await apiClient.post('/api/v1/admin/billing/change-plan', { planId });
      if (res.success) {
        toast.success(t('planChanged'));
        router.push('/admin/billing');
      } else {
        toast.error(res.error || t('changeError'));
      }
    } catch {
      toast.error(t('changeError'));
    } finally {
      setChangingPlanId(null);
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
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t('intro')}</p>
      </div>

      {plans.length === 0 ? (
        <p className="text-[var(--color-text-secondary)]">{t('emptyPlans')}</p>
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
                <span className="text-sm text-[var(--color-text-secondary)]">
                  {' '}
                  {t('priceMonthly')}
                </span>
              </div>

              <div className="mb-4 text-sm text-[var(--color-text-secondary)]">
                {t('priceYearly', { price: plan.priceYearly })}
              </div>

              <div className="mb-6 flex-1 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-green-500">&#10003;</span>
                  <span>{t('featureProducts', { count: plan.maxProducts })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">&#10003;</span>
                  <span>{t('featureOrders', { count: plan.maxOrders })}</span>
                </div>
                {plan.features &&
                  typeof plan.features === 'object' &&
                  Object.entries(plan.features as Record<string, unknown>).map(([key, value]) => {
                    // Display value safely: scalars render directly, complex
                    // values get JSON.stringify'd. Length-cap both sides so
                    // a malicious / malformed JSON in `features` can't blow
                    // up the layout or render unbounded HTML-looking text.
                    const display =
                      typeof value === 'string' ||
                      typeof value === 'number' ||
                      typeof value === 'boolean'
                        ? String(value)
                        : JSON.stringify(value);
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-green-500">&#10003;</span>
                        <span>
                          {String(key).slice(0, 64)}: {display.slice(0, 200)}
                        </span>
                      </div>
                    );
                  })}
              </div>

              <Button
                onClick={() => handleSelectPlan(plan.id)}
                isLoading={changingPlanId === plan.id}
                className="w-full"
              >
                {t('selectPlan')}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
