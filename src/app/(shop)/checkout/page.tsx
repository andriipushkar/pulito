'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { checkoutSchema, type CheckoutInput } from '@/validators/order';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { Cart as CartIcon } from '@/components/icons';
import CheckoutSteps from '@/components/checkout/CheckoutSteps';
import StepContacts from '@/components/checkout/StepContacts';
import StepDelivery from '@/components/checkout/StepDelivery';
import StepPayment from '@/components/checkout/StepPayment';
import StepConfirmation from '@/components/checkout/StepConfirmation';
import OrderSuccess from '@/components/checkout/OrderSuccess';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clearCart } = useCart();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyPointsToSpend, setLoyaltyPointsToSpend] = useState(0);
  const [formData, setFormData] = useState<Partial<CheckoutInput>>(() => ({
    contactName: user?.fullName || '',
    contactEmail: user?.email || '',
    contactPhone: '',
    deliveryMethod: undefined,
    paymentMethod: undefined,
    comment: '',
  }));

  const cartTotal = total();

  // Fetch loyalty balance for authenticated users
  useEffect(() => {
    if (!user) return;
    apiClient
      .get<{ account: { points: number } }>('/api/v1/me/loyalty')
      .then((res) => {
        if (res.success && res.data?.account) {
          setLoyaltyPoints(res.data.account.points);
        }
      })
      .catch(() => {});
  }, [user]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleLoyaltyPointsChange = (points: number) => {
    setLoyaltyPointsToSpend(points);
    setFormData((prev) => ({ ...prev, loyaltyPointsToSpend: points }));
  };

  const validateStep = (stepNumber: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepNumber === 1) {
      if (!formData.contactName || formData.contactName.length < 2) {
        newErrors.contactName = "Мінімум 2 символи";
      }
      if (!formData.contactPhone || formData.contactPhone.length < 10) {
        newErrors.contactPhone = 'Введіть коректний номер телефону';
      }
      if (!formData.contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
        newErrors.contactEmail = 'Невірний формат email';
      }
      if (formData.edrpou && formData.edrpou.length !== 8) {
        newErrors.edrpou = 'ЄДРПОУ має містити 8 цифр';
      }
    }

    if (stepNumber === 2) {
      if (!formData.deliveryMethod) {
        newErrors.deliveryMethod = 'Оберіть спосіб доставки';
      }
      const needsAddress = formData.deliveryMethod === 'nova_poshta' || formData.deliveryMethod === 'ukrposhta';
      if (needsAddress && !formData.deliveryCity) {
        newErrors.deliveryCity = 'Вкажіть місто';
      }
      if (needsAddress && !formData.deliveryAddress) {
        newErrors.deliveryAddress = 'Вкажіть адресу';
      }
    }

    if (stepNumber === 3) {
      if (!formData.paymentMethod) {
        newErrors.paymentMethod = 'Оберіть спосіб оплати';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, 4));
    }
  };

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async () => {
    const submitData = {
      ...formData,
      loyaltyPointsToSpend: loyaltyPointsToSpend > 0 ? loyaltyPointsToSpend : undefined,
    };

    const parsed = checkoutSchema.safeParse(submitData);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0] as string;
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      // Sync cart to server first if user is authenticated
      if (user) {
        await apiClient.put('/api/v1/cart', { items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })) });
      }

      const res = await apiClient.post<{
        id: number;
        orderNumber: string;
        paymentRequired?: boolean;
      }>('/api/v1/orders', parsed.data);

      if (res.success && res.data) {
        clearCart();

        // If online payment — initiate payment and redirect
        if (res.data.paymentRequired && parsed.data.paymentProvider) {
          const payRes = await apiClient.post<{ redirectUrl: string }>(
            `/api/v1/orders/${res.data.id}/pay`,
            { provider: parsed.data.paymentProvider }
          );

          if (payRes.success && payRes.data?.redirectUrl) {
            window.location.href = payRes.data.redirectUrl;
            return;
          }

          // Payment initiation failed — still show order number, user can pay later
          setOrderNumber(res.data.orderNumber);
          setErrors({ submit: 'Замовлення створено, але не вдалося ініціювати оплату. Сплатіть через "Мої замовлення".' });
        } else {
          setOrderNumber(res.data.orderNumber);
        }
      } else {
        setErrors({ submit: res.error || 'Помилка при створенні замовлення' });
      }
    } catch {
      setErrors({ submit: 'Помилка мережі. Спробуйте ще раз.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderNumber) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <OrderSuccess orderNumber={orderNumber} />
        {errors.submit && (
          <p className="mt-4 text-center text-sm text-yellow-600">{errors.submit}</p>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <EmptyState
          icon={<CartIcon size={48} />}
          title="Кошик порожній"
          description="Додайте товари, щоб оформити замовлення"
          actionLabel="Перейти до каталогу"
          actionHref="/catalog"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Breadcrumbs
        items={[
          { label: 'Головна', href: '/' },
          { label: 'Кошик', href: '/cart' },
          { label: 'Оформлення замовлення' },
        ]}
        className="mb-6"
      />

      <h1 className="mb-6 text-2xl font-bold">Оформлення замовлення</h1>

      <CheckoutSteps currentStep={step} />

      <div className="gap-6 lg:grid lg:grid-cols-[1fr_340px]">
        {/* Left: form steps */}
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
          {step === 1 && <StepContacts data={formData} errors={errors} onChange={handleChange} />}
          {step === 2 && <StepDelivery data={formData} errors={errors} onChange={handleChange} />}
          {step === 3 && <StepPayment data={formData} errors={errors} onChange={handleChange} />}
          {step === 4 && (
            <StepConfirmation
              data={formData}
              items={items}
              total={cartTotal}
              loyaltyPoints={loyaltyPoints}
              loyaltyPointsToSpend={loyaltyPointsToSpend}
              onLoyaltyPointsChange={handleLoyaltyPointsChange}
            />
          )}

          {errors.submit && (
            <p className="mt-4 text-sm text-[var(--color-danger)]">{errors.submit}</p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            {step > 1 ? (
              <Button variant="outline" onClick={handleBack} className="w-full sm:w-auto">
                Назад
              </Button>
            ) : (
              <Button variant="outline" onClick={() => router.push('/cart')} className="w-full sm:w-auto">
                Повернутись до кошика
              </Button>
            )}

            {step < 4 ? (
              <Button onClick={handleNext} className="w-full sm:w-auto">Далі</Button>
            ) : (
              <Button onClick={handleSubmit} isLoading={isSubmitting} className="w-full sm:w-auto">
                Підтвердити замовлення
              </Button>
            )}
          </div>
        </div>

        {/* Right: order summary (desktop) */}
        <div className="mt-6 lg:mt-0">
          <div className="sticky top-[140px] rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Ваше замовлення</h3>
            <div className="max-h-[280px] space-y-3 overflow-y-auto">
              {items.map((item) => (
                <div key={item.productId} className="flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--color-bg-secondary)]">
                    {item.imagePath ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={item.imagePath} alt={item.name} className="h-full w-full object-contain" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
                        <CartIcon size={16} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{item.name}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{item.quantity} x {item.priceRetail.toFixed(0)} ₴</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">{(item.priceRetail * item.quantity).toFixed(0)} ₴</span>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-[var(--color-border)] pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">Разом</span>
                <span className="text-lg font-bold">{cartTotal.toFixed(0)} ₴</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
