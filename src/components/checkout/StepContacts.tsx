'use client';

import { useTranslations } from 'next-intl';
import Input from '@/components/ui/Input';
import PhoneInput, { cleanPhone } from '@/components/ui/PhoneInput';
import type { CheckoutInput } from '@/validators/order';

interface StepContactsProps {
  data: Partial<CheckoutInput>;
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
}

export default function StepContacts({ data, errors, onChange }: StepContactsProps) {
  const t = useTranslations('checkout');

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t('stepContacts')}</h2>

      <Input
        label={`${t('contactName')} *`}
        value={data.contactName || ''}
        onChange={(e) => onChange('contactName', e.target.value)}
        error={errors.contactName}
        placeholder="Іванов Іван"
      />

      <PhoneInput
        label={`${t('contactPhone')} *`}
        value={data.contactPhone || ''}
        onChange={(e) => onChange('contactPhone', cleanPhone(e.target.value))}
        error={errors.contactPhone}
      />

      <Input
        label={`${t('contactEmail')} *`}
        type="email"
        value={data.contactEmail || ''}
        onChange={(e) => onChange('contactEmail', e.target.value)}
        error={errors.contactEmail}
        placeholder="email@example.com"
      />

      <div className="border-t border-[var(--color-border)] pt-4">
        <p className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">
          {t('companySection')}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('companyName')}
            value={data.companyName || ''}
            onChange={(e) => onChange('companyName', e.target.value)}
            error={errors.companyName}
          />
          <Input
            label={t('edrpou')}
            value={data.edrpou || ''}
            onChange={(e) => onChange('edrpou', e.target.value)}
            error={errors.edrpou}
            placeholder="12345678"
            maxLength={8}
          />
        </div>
      </div>
    </div>
  );
}
