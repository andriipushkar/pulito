'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { mutate as globalMutate } from 'swr';
import { useRouter } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { gtagEvent } from '@/lib/gtag';
import { checkoutSchema, type CheckoutInput } from '@/validators/order';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { Cart as CartIcon, Plus, Minus, Trash } from '@/components/icons';
import Image from 'next/image';
import StepContacts from '@/components/checkout/StepContacts';
import StepDelivery from '@/components/checkout/StepDelivery';
import StepPayment from '@/components/checkout/StepPayment';
import StepConfirmation from '@/components/checkout/StepConfirmation';
import OrderSuccess from '@/components/checkout/OrderSuccess';
import FreeShippingBar from '@/components/checkout/FreeShippingBar';
import StockWarningBanner from '@/components/checkout/StockWarningBanner';
import { useCartStockValidation } from '@/hooks/useCartStockValidation';
import CheckoutSection from '@/components/checkout/CheckoutSection';
import SubscriptionToggle, {
  type SubscriptionFrequency,
} from '@/components/checkout/SubscriptionToggle';
import { DELIVERY_METHOD_LABELS, PAYMENT_METHOD_LABELS } from '@/types/order';

const SUBSCRIPTION_DISCOUNT_PERCENT = 5;
import PageViewTracker from '@/components/analytics/PageViewTracker';
import { trackEvent } from '@/lib/event-tracker';
import type { CheckoutConfig } from '@/services/checkout-config';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clearCart, updateQuantity, removeItem } = useCart();
  const { user } = useAuth();
  const [expandedStep, setExpandedStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyPointsToSpend, setLoyaltyPointsToSpend] = useState(0);
  const [config, setConfig] = useState<CheckoutConfig | null>(null);
  const [showAllItems, setShowAllItems] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Record<number, SubscriptionFrequency>>({});

  const setSubscriptionForItem = (
    productId: number,
    next: { enabled: boolean; frequency: SubscriptionFrequency },
  ) => {
    setSubscriptions((prev) => {
      const updated = { ...prev };
      if (next.enabled) {
        updated[productId] = next.frequency;
      } else {
        delete updated[productId];
      }
      return updated;
    });
  };
  const [savedAddresses, setSavedAddresses] = useState<
    {
      deliveryMethod: string;
      city: string;
      address: string;
      warehouseRef: string | null;
    }[]
  >([]);
  const [formData, setFormData] = useState<Partial<CheckoutInput> & { paymentNote?: string }>(
    () => ({
      contactName: user?.fullName || '',
      contactEmail: user?.email || '',
      contactPhone: '',
      deliveryMethod: undefined,
      paymentMethod: undefined,
      comment: '',
      paymentNote: '',
    }),
  );

  const clientCartTotal = total(user?.role, user?.wholesaleGroup);

  // Block submit while the cart has known stock conflicts (out-of-stock items
  // or quantity > available). The banner already tells the user what's wrong;
  // disabling Submit prevents them from clicking, waiting for a server 400,
  // and seeing a generic "помилка створення замовлення" alert.
  const { issues: stockIssues } = useCartStockValidation(items);
  const hasStockIssues = stockIssues.length > 0;

  type ServerCartItem = {
    quantity: number;
    personalPrice: number | null;
    volumeDiscount: { discountedPrice: number; discountPercent: number } | null;
    product: {
      priceRetail: string | number;
      priceWholesale?: string | number | null;
      priceWholesale2?: string | number | null;
      priceWholesale3?: string | number | null;
    };
  };
  const [serverCart, setServerCart] = useState<ServerCartItem[] | null>(null);

  useEffect(() => {
    if (!user) {
      setServerCart(null);
      return;
    }
    apiClient
      .get<ServerCartItem[]>('/api/v1/cart')
      .then((res) => {
        if (res.success && Array.isArray(res.data)) setServerCart(res.data);
      })
      .catch(() => {});
  }, [user, items.length]);

  const serverCartTotal = useMemo(() => {
    if (!serverCart) return null;
    const groupRaw = user?.wholesaleGroup;
    const group = typeof groupRaw === 'number' ? groupRaw : null;
    return serverCart.reduce((sum, item) => {
      let price: number;
      if (item.personalPrice !== null && item.personalPrice !== undefined) {
        price = item.personalPrice;
      } else if (user?.role === 'wholesaler' && group) {
        const tier =
          group === 1
            ? item.product.priceWholesale
            : group === 2
              ? item.product.priceWholesale2
              : group === 3
                ? item.product.priceWholesale3
                : null;
        price = tier != null ? Number(tier) : Number(item.product.priceRetail);
      } else {
        price = Number(item.product.priceRetail);
      }
      if (item.volumeDiscount) price = item.volumeDiscount.discountedPrice;
      return sum + price * item.quantity;
    }, 0);
  }, [serverCart, user?.role, user?.wholesaleGroup]);

  // Fall back to the client cart total whenever the server cart is missing OR
  // empty. Previously `?? clientCartTotal` only triggered on null, so a logged-in
  // user whose local cart hadn't been synced yet would see Сума товарів = 0
  // even though the items list rendered the products correctly.
  const cartTotal =
    serverCart && serverCart.length > 0 && serverCartTotal !== null
      ? serverCartTotal
      : clientCartTotal;

  const estimatedDeliveryCost = useMemo(() => {
    if (!config) return 0;
    const method = formData.deliveryMethod;
    if (!method || method === 'pickup' || method === 'pallet') return 0;
    const threshold = config.delivery.freeShippingThreshold;
    if (threshold && cartTotal >= threshold) return 0;
    if (method === 'nova_poshta') return config.delivery.fixedCost.nova_poshta ?? 0;
    if (method === 'ukrposhta') return config.delivery.fixedCost.ukrposhta ?? 0;
    return 0;
  }, [config, formData.deliveryMethod, cartTotal]);

  useEffect(() => {
    apiClient
      .get<CheckoutConfig>('/api/v1/checkout/config')
      .then((res) => {
        if (res.success && res.data) setConfig(res.data);
      })
      .catch((err) => {
        console.warn('Failed to load checkout config', err);
      });
  }, []);

  // Заповнюємо контактні поля з профілю, коли user довантажиться. При першому
  // mount AuthProvider ще може refresh-ити сесію (user=null) і useState
  // initial-snapshot зберігає пусті рядки — без цього ефекту користувач
  // змушений вводити те, що вже є в кабінеті.
  useEffect(() => {
    if (!user) return;
    setFormData((prev) => ({
      ...prev,
      contactName: prev.contactName || user.fullName || '',
      contactEmail: prev.contactEmail || user.email || '',
      contactPhone: prev.contactPhone || user.phone || '',
    }));
  }, [user]);

  // Load saved addresses for authenticated users (autofill from past orders).
  useEffect(() => {
    if (!user) return;
    apiClient
      .get<typeof savedAddresses>('/api/v1/me/saved-addresses')
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setSavedAddresses(res.data);
          // Auto-apply most recent address if user hasn't started filling delivery yet
          const mostRecent = res.data[0];
          if (mostRecent) {
            setFormData((prev) =>
              prev.deliveryMethod
                ? prev
                : {
                    ...prev,
                    deliveryMethod: mostRecent.deliveryMethod as CheckoutInput['deliveryMethod'],
                    deliveryCity: mostRecent.city,
                    deliveryAddress: mostRecent.address,
                    deliveryWarehouseRef: mostRecent.warehouseRef ?? '',
                  },
            );
          }
        }
      })
      .catch(() => {});
  }, [user]);

  const applyAddress = (addr: (typeof savedAddresses)[0]) => {
    setFormData((prev) => ({
      ...prev,
      deliveryMethod: addr.deliveryMethod as CheckoutInput['deliveryMethod'],
      deliveryCity: addr.city,
      deliveryAddress: addr.address,
      deliveryWarehouseRef: addr.warehouseRef ?? '',
    }));
  };

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
        newErrors.contactName = 'Мінімум 2 символи';
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
      if (config?.delivery.manualMode) {
        if (!formData.deliveryAddress || formData.deliveryAddress.trim().length < 5) {
          newErrors.deliveryAddress = 'Опишіть, як вам зручно отримати товар (мінімум 5 символів)';
        }
      } else {
        if (!formData.deliveryMethod) {
          newErrors.deliveryMethod = 'Оберіть спосіб доставки';
        }
        if (formData.deliveryMethod === 'nova_poshta') {
          if (!formData.deliveryCity) newErrors.deliveryCity = 'Оберіть місто зі списку';
          // Two valid modes: warehouseRef (відділення) OR streetRef+building (D2D).
          const hasWarehouse = !!formData.deliveryWarehouseRef;
          const hasD2D = !!formData.deliveryStreetRef && !!formData.deliveryBuilding;
          if (!hasWarehouse && !hasD2D) {
            if (formData.deliveryStreetRef && !formData.deliveryBuilding) {
              newErrors.deliveryBuilding = 'Вкажіть будинок';
            } else {
              newErrors.deliveryAddress = 'Оберіть відділення або заповніть адресу';
            }
          }
        } else if (formData.deliveryMethod === 'ukrposhta') {
          if (!formData.deliveryCity) newErrors.deliveryCity = 'Вкажіть місто';
          if (!formData.deliveryAddress) newErrors.deliveryAddress = 'Вкажіть адресу';
        }
      }
    }

    if (stepNumber === 3) {
      if (config?.payment.manualMode) {
        if (!formData.paymentNote || formData.paymentNote.trim().length < 3) {
          newErrors.paymentNote = 'Опишіть, як вам зручно оплатити';
        }
      } else if (!formData.paymentMethod) {
        newErrors.paymentMethod = 'Оберіть спосіб оплати';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const completeAndAdvance = (stepNumber: number) => {
    if (!validateStep(stepNumber)) return;
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(stepNumber);
      return next;
    });
    setExpandedStep(Math.min(stepNumber + 1, 4));
  };

  const editStep = (stepNumber: number) => {
    setExpandedStep(stepNumber);
  };

  const allCompleted = [1, 2, 3, 4].every((s) => completedSteps.has(s));

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    // GA4: begin_checkout
    gtagEvent.beginCheckout(
      items.map((i) => ({
        item_id: i.code || String(i.productId),
        item_name: i.name,
        price: Number(i.priceRetail),
        quantity: i.quantity,
      })),
      cartTotal + estimatedDeliveryCost - loyaltyPointsToSpend,
    );

    const deliveryManual = !!config?.delivery.manualMode;
    const paymentManual = !!config?.payment.manualMode;

    const mergedComment =
      paymentManual && formData.paymentNote
        ? `[Оплата (зазначив клієнт)]: ${formData.paymentNote.trim()}${formData.comment ? `\n\n${formData.comment}` : ''}`
        : formData.comment;

    const { paymentNote: _ignored, ...rest } = formData;
    const submitData = {
      ...rest,
      deliveryMethod: deliveryManual ? 'pickup' : formData.deliveryMethod,
      paymentMethod: paymentManual ? 'cod' : formData.paymentMethod,
      paymentProvider: paymentManual ? undefined : formData.paymentProvider,
      comment: mergedComment,
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
      setIsSubmitting(false);
      return;
    }

    try {
      // Sync cart to server first if user is authenticated.
      // mode=replace mirrors the client list exactly — items the user removed
      // here must not survive on the server, or the order builder will
      // re-include them and charge for things the customer deleted.
      if (user) {
        const syncRes = await apiClient.put('/api/v1/cart', {
          mode: 'replace',
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        });
        if (!syncRes.success) {
          setErrors({
            submit:
              syncRes.error ||
              'Не вдалося синхронізувати кошик. Перезавантажте сторінку і спробуйте ще раз.',
          });
          setIsSubmitting(false);
          return;
        }
      }

      // For guest checkout the server expects items in the body (guestCheckoutSchema)
      const requestBody = user
        ? parsed.data
        : {
            ...parsed.data,
            items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          };

      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `ck-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }

      const res = await apiClient.post<{
        id: number;
        orderNumber: string;
        paymentRequired?: boolean;
      }>('/api/v1/orders', requestBody, {
        headers: { 'x-idempotency-key': idempotencyKeyRef.current },
      });

      if (res.success && res.data) {
        trackEvent({
          eventType: 'order_completed',
          orderId: res.data.id,
          metadata: {
            orderNumber: res.data.orderNumber,
            total: total(user?.role, user?.wholesaleGroup),
          },
        });

        // Create subscriptions for any items the user opted into.
        // Group by frequency so users with multiple cadences get one subscription per cadence.
        if (user && Object.keys(subscriptions).length > 0) {
          const byFrequency = new Map<
            SubscriptionFrequency,
            { productId: number; quantity: number }[]
          >();
          for (const [productIdStr, frequency] of Object.entries(subscriptions)) {
            const productId = Number(productIdStr);
            const cartItem = items.find((i) => i.productId === productId);
            if (!cartItem) continue;
            const bucket = byFrequency.get(frequency) ?? [];
            bucket.push({ productId, quantity: cartItem.quantity });
            byFrequency.set(frequency, bucket);
          }

          await Promise.all(
            Array.from(byFrequency.entries()).map(([frequency, subItems]) =>
              apiClient
                .post('/api/v1/me/subscriptions', {
                  frequency,
                  items: subItems,
                  deliveryMethod: parsed.data.deliveryMethod,
                  deliveryCity: parsed.data.deliveryCity,
                  deliveryAddress: parsed.data.deliveryAddress,
                  paymentMethod: parsed.data.paymentMethod,
                })
                .catch(() => null),
            ),
          );
        }

        clearCart();

        if (user) {
          // Loyalty balance and saved addresses changed — invalidate caches.
          globalMutate('/api/v1/me/loyalty');
          globalMutate('/api/v1/me/saved-addresses');
          globalMutate('/api/v1/orders');
        }

        // If online payment — initiate payment and redirect
        if (res.data.paymentRequired && parsed.data.paymentProvider) {
          const payRes = await apiClient.post<{ redirectUrl: string }>(
            `/api/v1/orders/${res.data.id}/pay`,
            { provider: parsed.data.paymentProvider },
          );

          if (payRes.success && payRes.data?.redirectUrl) {
            const allowedHosts = [
              'liqpay.ua',
              'www.liqpay.ua',
              'pay.liqpay.ua',
              'secure.wayforpay.com',
              'pay.fondy.eu',
              'api.monobank.ua',
              'pay.monobank.ua',
            ];
            try {
              const url = new URL(payRes.data.redirectUrl, window.location.origin);
              const isHttps = url.protocol === 'https:';
              const isSameOrigin = url.origin === window.location.origin;
              const isAllowedHost = allowedHosts.some(
                (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
              );
              if (isHttps && (isSameOrigin || isAllowedHost)) {
                window.location.href = url.toString();
                return;
              }
              console.warn('Blocked payment redirect to unrecognized host', url.hostname);
            } catch (err) {
              console.warn('Invalid payment redirect URL', err);
            }
          }

          // Payment initiation failed — still show order number, user can pay later
          setOrderNumber(res.data.orderNumber);
          setErrors({
            submit:
              'Замовлення створено, але не вдалося ініціювати оплату. Сплатіть через "Мої замовлення".',
          });
        } else {
          setOrderNumber(res.data.orderNumber);
        }
        // GA4: purchase (fire regardless of payment branch)
        gtagEvent.purchase({
          transaction_id: res.data.orderNumber,
          value: cartTotal + estimatedDeliveryCost - loyaltyPointsToSpend,
          shipping: estimatedDeliveryCost,
          items: items.map((i) => ({
            item_id: i.code || String(i.productId),
            item_name: i.name,
            price: Number(i.priceRetail),
            quantity: i.quantity,
          })),
        });
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
        <OrderSuccess
          orderNumber={orderNumber}
          guestContact={
            !user && formData.contactEmail
              ? {
                  email: formData.contactEmail,
                  fullName: formData.contactName || '',
                  phone: formData.contactPhone || '',
                }
              : undefined
          }
        />
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
      <PageViewTracker
        eventType="checkout_started"
        metadata={{
          step: expandedStep,
          itemCount: items.length,
          total: total(user?.role, user?.wholesaleGroup),
        }}
      />
      <Breadcrumbs
        items={[
          { label: 'Головна', href: '/' },
          { label: 'Кошик', href: '/cart' },
          { label: 'Оформлення замовлення' },
        ]}
        className="mb-6"
      />

      <h1 className="mb-6 text-2xl font-bold">Оформлення замовлення</h1>

      <StockWarningBanner />

      <div className="gap-6 lg:grid lg:grid-cols-[1fr_340px]">
        {/* Left: stacked sections */}
        <div className="space-y-3">
          <CheckoutSection
            step={1}
            title="Контактна інформація"
            summary={
              formData.contactName
                ? `${formData.contactName} • ${formData.contactPhone} • ${formData.contactEmail}`
                : ''
            }
            expanded={expandedStep === 1}
            completed={completedSteps.has(1)}
            onEdit={() => editStep(1)}
            onContinue={() => completeAndAdvance(1)}
          >
            <StepContacts data={formData} errors={errors} onChange={handleChange} />
          </CheckoutSection>

          <CheckoutSection
            step={2}
            title="Доставка"
            summary={
              formData.deliveryMethod
                ? `${DELIVERY_METHOD_LABELS[formData.deliveryMethod]}${formData.deliveryCity ? ` • ${formData.deliveryCity}` : ''}${formData.deliveryAddress ? ` • ${formData.deliveryAddress}` : ''}`
                : ''
            }
            expanded={expandedStep === 2}
            completed={completedSteps.has(2)}
            onEdit={() => editStep(2)}
            onContinue={() => completeAndAdvance(2)}
          >
            {savedAddresses.length > 0 && (
              <div className="mb-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
                <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
                  Збережені адреси з минулих замовлень
                </p>
                <div className="flex flex-wrap gap-2">
                  {savedAddresses.map((a, i) => {
                    const isActive =
                      formData.deliveryCity === a.city &&
                      formData.deliveryAddress === a.address &&
                      (formData.deliveryWarehouseRef ?? '') === (a.warehouseRef ?? '');
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => applyAddress(a)}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                          isActive
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 font-medium text-[var(--color-primary)]'
                            : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)]'
                        }`}
                      >
                        {i === 0 && '⭐ '}
                        {a.city} — {a.address}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <StepDelivery
              data={formData}
              errors={errors}
              onChange={handleChange}
              cartTotal={cartTotal}
              config={config}
            />
          </CheckoutSection>

          <CheckoutSection
            step={3}
            title="Оплата"
            summary={
              formData.paymentMethod
                ? `${PAYMENT_METHOD_LABELS[formData.paymentMethod]}${formData.paymentProvider ? ` • ${formData.paymentProvider}` : ''}`
                : ''
            }
            expanded={expandedStep === 3}
            completed={completedSteps.has(3)}
            onEdit={() => editStep(3)}
            onContinue={() => completeAndAdvance(3)}
          >
            <StepPayment
              data={formData}
              errors={errors}
              onChange={handleChange}
              config={config}
              cartTotal={cartTotal}
            />
          </CheckoutSection>

          <CheckoutSection
            step={4}
            title="Перевірка замовлення"
            expanded={expandedStep === 4}
            completed={completedSteps.has(4)}
            onEdit={() => editStep(4)}
            onContinue={() => completeAndAdvance(4)}
            continueLabel="Готово до оплати"
          >
            <StepConfirmation
              data={formData}
              items={items}
              total={cartTotal}
              loyaltyPoints={loyaltyPoints}
              loyaltyPointsToSpend={loyaltyPointsToSpend}
              onLoyaltyPointsChange={handleLoyaltyPointsChange}
              config={config}
            />
          </CheckoutSection>

          {errors.submit && <p className="text-sm text-[var(--color-danger)]">{errors.submit}</p>}

          {/* Sticky submit on mobile, inline on desktop */}
          <div className="sticky bottom-0 -mx-4 border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="outline"
                onClick={() => router.push('/cart')}
                className="w-full sm:w-auto"
              >
                Повернутись до кошика
              </Button>
              <div className="flex items-center gap-3 sm:gap-4">
                <span className="hidden text-sm text-[var(--color-text-secondary)] sm:inline">
                  До оплати:
                </span>
                <span className="text-lg font-bold tabular-nums">
                  {(cartTotal + estimatedDeliveryCost - loyaltyPointsToSpend).toFixed(2)} ₴
                </span>
                <Button
                  onClick={handleSubmit}
                  isLoading={isSubmitting}
                  disabled={!allCompleted || isSubmitting || hasStockIssues}
                  className="w-full sm:w-auto"
                  title={
                    hasStockIssues
                      ? 'Виправте проблеми із залишками вище, щоб оформити замовлення'
                      : undefined
                  }
                >
                  Підтвердити замовлення
                </Button>
              </div>
            </div>
            {/* Trust signals row */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-[var(--color-border)] pt-3 text-[11px] text-[var(--color-text-secondary)]">
              <span className="inline-flex items-center gap-1.5">
                <svg
                  className="h-3.5 w-3.5 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Безпечна оплата
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg
                  className="h-3.5 w-3.5 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9-1.5h11.25c.621 0 1.125-.504 1.125-1.125v-9.75M2.25 5.625v9.75c0 .621.504 1.125 1.125 1.125h11.25M17.625 7.5l1.875 1.875M16.875 11.25l3.75-3.75-3.75-3.75"
                  />
                </svg>
                Швидка доставка по Україні
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg
                  className="h-3.5 w-3.5 text-amber-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
                  />
                </svg>
                Повернення 14 днів
              </span>
            </div>
          </div>
        </div>

        {/* Right: order summary (desktop) */}
        <div className="mt-6 lg:mt-0">
          <div className="sticky top-[140px] rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Ваше замовлення
            </h3>
            {config?.delivery.freeShippingThreshold && (
              <div className="mb-4">
                <FreeShippingBar
                  threshold={config.delivery.freeShippingThreshold}
                  cartTotal={cartTotal}
                />
              </div>
            )}
            <div className="space-y-3">
              {(showAllItems || items.length <= 4 ? items : items.slice(0, 3)).map((item) => (
                <div key={item.productId} className="flex items-start gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--color-bg-secondary)]">
                    {item.imagePath ? (
                      <Image
                        src={item.imagePath}
                        alt={item.name}
                        fill
                        sizes="48px"
                        className="object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
                        <CartIcon size={16} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="line-clamp-2 text-xs font-medium" title={item.name}>
                      {item.name}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                        <button
                          type="button"
                          onClick={() =>
                            item.quantity <= 1
                              ? removeItem(item.productId)
                              : updateQuantity(item.productId, item.quantity - 1)
                          }
                          className="flex h-6 w-6 items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] disabled:opacity-30"
                          aria-label={item.quantity <= 1 ? 'Видалити' : 'Зменшити'}
                        >
                          {item.quantity <= 1 ? <Trash size={12} /> : <Minus size={12} />}
                        </button>
                        <span className="min-w-6 px-1 text-center text-xs font-semibold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          disabled={item.quantity >= item.maxQuantity}
                          className="flex h-6 w-6 items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] disabled:opacity-30"
                          aria-label="Збільшити"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {(item.priceRetail * item.quantity).toFixed(2)} ₴
                      </span>
                    </div>
                    {user && (
                      <SubscriptionToggle
                        enabled={subscriptions[item.productId] !== undefined}
                        frequency={subscriptions[item.productId] ?? 'monthly'}
                        discountPercent={SUBSCRIPTION_DISCOUNT_PERCENT}
                        onChange={(next) => setSubscriptionForItem(item.productId, next)}
                      />
                    )}
                  </div>
                </div>
              ))}
              {items.length > 4 && (
                <button
                  type="button"
                  onClick={() => setShowAllItems((v) => !v)}
                  className="w-full rounded-md py-1.5 text-center text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5"
                >
                  {showAllItems ? 'Згорнути' : `Показати всі ${items.length} товарів`}
                </button>
              )}
            </div>
            <div className="mt-4 space-y-1.5 border-t border-[var(--color-border)] pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Сума товарів</span>
                <span className="tabular-nums">{cartTotal.toFixed(2)} ₴</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Доставка</span>
                <span className="tabular-nums">
                  {formData.deliveryMethod
                    ? estimatedDeliveryCost > 0
                      ? `${estimatedDeliveryCost.toFixed(2)} ₴`
                      : 'Безкоштовно'
                    : '—'}
                </span>
              </div>
              {loyaltyPointsToSpend > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">Бонуси</span>
                  <span className="tabular-nums text-[var(--color-primary)]">
                    −{loyaltyPointsToSpend.toFixed(2)} ₴
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2">
                <span className="text-sm font-semibold">Разом до сплати</span>
                <span className="text-lg font-bold tabular-nums">
                  {(cartTotal + estimatedDeliveryCost - loyaltyPointsToSpend).toFixed(2)} ₴
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
