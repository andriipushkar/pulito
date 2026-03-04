'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import PhoneInput, { cleanPhone } from '@/components/ui/PhoneInput';
import Spinner from '@/components/ui/Spinner';

type WholesaleStatus = 'none' | 'pending' | 'approved' | 'rejected';

interface WholesaleData {
  wholesaleStatus: WholesaleStatus;
  wholesaleRequestDate: string | null;
  wholesaleApprovedDate: string | null;
  companyName: string | null;
  edrpou: string | null;
  ownershipType: string | null;
  taxSystem: string | null;
  legalAddress: string | null;
  contactPersonName: string | null;
  contactPersonPhone: string | null;
  wholesaleMonthlyVol: string | null;
}

const inputClass =
  'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm outline-none transition-all focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20';
const labelClass = 'mb-1.5 block text-sm font-medium text-[var(--color-text)]';

export default function WholesaleRequestPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState<WholesaleData | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [edrpou, setEdrpou] = useState('');
  const [ownershipType, setOwnershipType] = useState('');
  const [taxSystem, setTaxSystem] = useState('');
  const [legalAddress, setLegalAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [monthlyVol, setMonthlyVol] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    apiClient.get<WholesaleData>('/api/v1/me/wholesale-request').then((res) => {
      if (res.success && res.data) {
        setData(res.data);
        if (res.data.companyName) setCompanyName(res.data.companyName);
        if (res.data.edrpou) setEdrpou(res.data.edrpou);
        if (res.data.ownershipType) setOwnershipType(res.data.ownershipType);
        if (res.data.taxSystem) setTaxSystem(res.data.taxSystem);
        if (res.data.legalAddress) setLegalAddress(res.data.legalAddress);
        if (res.data.contactPersonName) setContactName(res.data.contactPersonName);
        if (res.data.contactPersonPhone) setContactPhone(res.data.contactPersonPhone);
        if (res.data.wholesaleMonthlyVol) setMonthlyVol(res.data.wholesaleMonthlyVol);
      }
    }).finally(() => setIsLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await apiClient.post('/api/v1/me/wholesale-request', {
        companyName,
        edrpou,
        ownershipType: ownershipType || undefined,
        taxSystem: taxSystem || undefined,
        legalAddress,
        contactPersonName: contactName || user?.fullName,
        contactPersonPhone: cleanPhone(contactPhone),
        wholesaleMonthlyVol: monthlyVol,
        comment,
      });

      if (res.success) {
        toast.success('Заявку подано! Менеджер зв\'яжеться з вами найближчим часом.');
        setData((prev) => prev ? { ...prev, wholesaleStatus: 'pending', wholesaleRequestDate: new Date().toISOString() } : prev);
      } else {
        toast.error(res.error || 'Помилка при подачі заявки');
      }
    } catch {
      toast.error('Помилка з\'єднання');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  // Already a wholesaler
  if (user?.role === 'wholesaler') {
    return (
      <div className="mx-auto max-w-2xl py-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 className="mb-2 text-xl font-bold">Ви оптовий клієнт!</h2>
        <p className="text-[var(--color-text-secondary)]">
          Вам доступні оптові ціни та спеціальні умови.
        </p>
      </div>
    );
  }

  // Pending request
  if (data?.wholesaleStatus === 'pending') {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <h2 className="mb-2 text-xl font-bold text-amber-900">Заявка на розгляді</h2>
          <p className="mb-4 text-sm text-amber-700">
            Ваша заявка подана {data.wholesaleRequestDate
              ? new Date(data.wholesaleRequestDate).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
              : ''
            }. Наш менеджер зв&apos;яжеться з вами найближчим часом для уточнення деталей.
          </p>
          <div className="rounded-xl bg-white p-4 text-left text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              {data.companyName && <div><span className="text-amber-600">Компанія:</span> {data.companyName}</div>}
              {data.edrpou && <div><span className="text-amber-600">ЄДРПОУ:</span> {data.edrpou}</div>}
              {data.contactPersonName && <div><span className="text-amber-600">Контакт:</span> {data.contactPersonName}</div>}
              {data.contactPersonPhone && <div><span className="text-amber-600">Телефон:</span> {data.contactPersonPhone}</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Rejected — allow re-submit
  const isRejected = data?.wholesaleStatus === 'rejected';

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Стати оптовим клієнтом</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Заповніть форму нижче і наш менеджер зв&apos;яжеться з вами для обговорення умов співпраці.
        </p>
      </div>

      {isRejected && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Попередню заявку було відхилено. Ви можете подати нову заявку з оновленими даними.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company info */}
        <div className="rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] p-6">
          <div className="mb-5 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <h2 className="text-base font-bold">Про компанію</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Назва компанії / ФОП *</label>
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required className={inputClass} placeholder="ТОВ «Назва» або ФОП Прізвище І.Б." />
            </div>
            <div>
              <label className={labelClass}>ЄДРПОУ / ІПН</label>
              <input type="text" value={edrpou} onChange={(e) => setEdrpou(e.target.value.replace(/\D/g, '').slice(0, 10))} className={inputClass} placeholder="12345678" maxLength={10} />
            </div>
            <div>
              <label className={labelClass}>Форма власності</label>
              <select value={ownershipType} onChange={(e) => setOwnershipType(e.target.value)} className={inputClass}>
                <option value="">Оберіть</option>
                <option value="fop">ФОП</option>
                <option value="tov">ТОВ</option>
                <option value="pp">ПП</option>
                <option value="other">Інше</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Система оподаткування</label>
              <select value={taxSystem} onChange={(e) => setTaxSystem(e.target.value)} className={inputClass}>
                <option value="">Оберіть</option>
                <option value="with_vat">Платник ПДВ</option>
                <option value="without_vat">Спрощена система</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Юридична адреса</label>
              <input type="text" value={legalAddress} onChange={(e) => setLegalAddress(e.target.value)} className={inputClass} placeholder="м. Київ, вул. ..." />
            </div>
          </div>
        </div>

        {/* Contact person */}
        <div className="rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] p-6">
          <div className="mb-5 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <h2 className="text-base font-bold">Контактна особа</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>ПІБ *</label>
              <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} required className={inputClass} placeholder={user?.fullName || 'Прізвище Ім\'я По батькові'} />
            </div>
            <div>
              <label className={labelClass}>Телефон *</label>
              <PhoneInput value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>

        {/* Additional */}
        <div className="rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-bg)] p-6">
          <div className="mb-5 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            </div>
            <h2 className="text-base font-bold">Деталі співпраці</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Очікуваний місячний обсяг</label>
              <select value={monthlyVol} onChange={(e) => setMonthlyVol(e.target.value)} className={inputClass}>
                <option value="">Оберіть</option>
                <option value="до 10 000 грн">до 10 000 грн</option>
                <option value="10 000 – 50 000 грн">10 000 – 50 000 грн</option>
                <option value="50 000 – 100 000 грн">50 000 – 100 000 грн</option>
                <option value="100 000+ грн">100 000+ грн</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Коментар до заявки</label>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className={inputClass} placeholder="Опишіть ваші потреби, категорії товарів, що цікавлять..." />
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-[var(--color-primary)] px-6 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110 disabled:opacity-50"
        >
          {isSubmitting ? 'Надсилання...' : 'Подати заявку'}
        </button>

        <p className="text-center text-xs text-[var(--color-text-secondary)]">
          Після подачі заявки наш менеджер зв&apos;яжеться з вами протягом 1-2 робочих днів.
        </p>
      </form>
    </div>
  );
}
