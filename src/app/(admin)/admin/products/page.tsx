'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';

interface AdminProduct {
  id: number;
  code: string;
  name: string;
  slug: string;
  priceRetail: number;
  priceWholesale: number | null;
  quantity: number;
  isActive: boolean;
  isPromo: boolean;
  imagePath: string | null;
  category: { id: number; name: string } | null;
}

export default function AdminProductsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');

  const page = Number(searchParams.get('page')) || 1;
  const limit = 20;

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const s = searchParams.get('search');
    if (s) params.set('search', s);

    apiClient
      .get<AdminProduct[]>(`/api/v1/admin/products?${params}`)
      .then((res) => {
        if (res.success && res.data) {
          setProducts(res.data);
          setTotal(res.pagination?.total || 0);
        }
      })
      .finally(() => setIsLoading(false));
  }, [page, searchParams]);

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set('search', search);
    else params.delete('search');
    params.set('page', '1');
    router.push(`/admin/products?${params}`);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Товари</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Пошук за назвою або кодом..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-64"
          />
          <Button variant="outline" size="sm" onClick={handleSearch}>
            Знайти
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="md" /></div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                  <th className="px-4 py-3 text-left font-medium">Товар</th>
                  <th className="px-4 py-3 text-left font-medium">Код</th>
                  <th className="px-4 py-3 text-left font-medium">Категорія</th>
                  <th className="px-4 py-3 text-right font-medium">Ціна</th>
                  <th className="px-4 py-3 text-center font-medium">Залишок</th>
                  <th className="px-4 py-3 text-center font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-[var(--color-bg-secondary)]">
                          {p.imagePath ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={p.imagePath} alt="" className="h-full w-full object-contain" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[8px] text-[var(--color-text-secondary)]">—</div>
                          )}
                        </div>
                        <Link href={`/admin/products/${p.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                          {p.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{p.code}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{p.category?.name || '—'}</td>
                    <td className="px-4 py-3 text-right">{Number(p.priceRetail).toFixed(2)} ₴</td>
                    <td className="px-4 py-3 text-center">
                      <span className={p.quantity === 0 ? 'text-[var(--color-danger)]' : ''}>
                        {p.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.isActive ? 'Активний' : 'Вимкнено'}
                      </span>
                      {p.isPromo && (
                        <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Акція</span>
                      )}
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                      Товарів не знайдено
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {total > limit && (
            <Pagination currentPage={page} totalPages={Math.ceil(total / limit)} baseUrl="/admin/products" className="mt-6" />
          )}
        </>
      )}
    </div>
  );
}
