'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';

interface CityRow {
  city: string;
  orders: number;
  revenue: number;
  ordersPercent: number;
  revenuePercent: number;
  avgCheck: number;
}

interface DeliveryRow {
  method: string;
  orders: number;
  revenue: number;
}

interface GeoData {
  cities: CityRow[];
  totalCities: number;
  totalOrders: number;
  totalRevenue: number;
  topCity: CityRow | null;
  byDeliveryMethod: DeliveryRow[];
}

const DELIVERY_LABELS: Record<string, string> = {
  nova_poshta: 'Нова Пошта',
  ukrposhta: 'Укрпошта',
  self_pickup: 'Самовивіз',
  courier: 'Кур\'єр',
  pallet: 'Палетна',
};

export default function GeographyAnalytics({ days }: { days: number }) {
  const [data, setData] = useState<GeoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient.get<GeoData>(`/api/v1/admin/analytics/geography?days=${days}`)
      .then((res) => { if (res.success && res.data) setData(res.data); })
      .finally(() => setIsLoading(false));
  }, [days]);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  if (!data) return null;

  const maxOrders = data.cities.length > 0 ? data.cities[0].orders : 1;

  return (
    <div>
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Міст</p>
          <p className="text-2xl font-bold">{data.totalCities}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Замовлень</p>
          <p className="text-2xl font-bold">{data.totalOrders}</p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Виручка</p>
          <p className="text-2xl font-bold">{data.totalRevenue.toFixed(0)} ₴</p>
        </div>
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Топ-місто</p>
          <p className="text-2xl font-bold">{data.topCity?.city || '—'}</p>
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Cities heatmap */}
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-4 text-sm font-semibold">Топ міст за замовленнями</h3>
          <div className="space-y-2">
            {data.cities.slice(0, 20).map((city) => (
              <div key={city.city} className="flex items-center gap-3">
                <span className="w-28 truncate text-xs font-medium">{city.city}</span>
                <div className="flex-1">
                  <div className="h-5 overflow-hidden rounded bg-[var(--color-bg-secondary)]">
                    <div
                      className="h-full rounded bg-[var(--color-primary)] transition-all"
                      style={{
                        width: `${(city.orders / maxOrders) * 100}%`,
                        opacity: 0.4 + (city.orders / maxOrders) * 0.6,
                      }}
                    />
                  </div>
                </div>
                <span className="w-12 text-right text-xs font-bold">{city.orders}</span>
                <span className="w-16 text-right text-xs text-[var(--color-text-secondary)]">{city.ordersPercent}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery methods */}
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <h3 className="mb-4 text-sm font-semibold">Способи доставки</h3>
          <div className="space-y-3">
            {data.byDeliveryMethod.map((m) => {
              const pct = data.totalOrders > 0 ? (m.orders / data.totalOrders) * 100 : 0;
              return (
                <div key={m.method} className="rounded-[var(--radius)] border border-[var(--color-border)] p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium">{DELIVERY_LABELS[m.method] || m.method}</span>
                    <span className="text-xs font-bold">{m.orders} зам.</span>
                  </div>
                  <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
                    <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-[var(--color-text-secondary)]">
                    <span>{pct.toFixed(1)}%</span>
                    <span>{m.revenue.toFixed(0)} ₴</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Full city table */}
      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-secondary)]">
            <tr>
              <th className="px-4 py-2 text-left">Місто</th>
              <th className="px-4 py-2 text-right">Замовлень</th>
              <th className="px-4 py-2 text-right">% замовлень</th>
              <th className="px-4 py-2 text-right">Виручка</th>
              <th className="px-4 py-2 text-right">% виручки</th>
              <th className="px-4 py-2 text-right">Сер. чек</th>
            </tr>
          </thead>
          <tbody>
            {data.cities.map((city) => (
              <tr key={city.city} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2 text-xs font-medium">{city.city}</td>
                <td className="px-4 py-2 text-right text-xs">{city.orders}</td>
                <td className="px-4 py-2 text-right text-xs">{city.ordersPercent}%</td>
                <td className="px-4 py-2 text-right text-xs">{city.revenue.toFixed(0)} ₴</td>
                <td className="px-4 py-2 text-right text-xs">{city.revenuePercent}%</td>
                <td className="px-4 py-2 text-right text-xs font-medium">{city.avgCheck} ₴</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
