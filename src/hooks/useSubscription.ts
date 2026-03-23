'use client';

import useSWR from 'swr';
import { useAuth } from '@/hooks/useAuth';
import { fetcher } from '@/lib/swr';
import { apiClient } from '@/lib/api-client';

export interface SubscriptionItem {
  id: number;
  quantity: number;
  product: {
    id: number;
    name: string;
    code?: string;
    priceRetail: number | string;
    imagePath?: string | null;
  };
}

export interface Subscription {
  id: number;
  frequency: string;
  status: string;
  nextDeliveryAt: string;
  createdAt: string;
  items: SubscriptionItem[];
}

export function useSubscriptions() {
  const { user } = useAuth();

  const { data, error, isLoading, mutate } = useSWR<Subscription[]>(
    user ? '/api/v1/me/subscriptions' : null,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 10000 }
  );

  return {
    subscriptions: data ?? [],
    error,
    isLoading,
    mutate,
  };
}

export interface CreateSubscriptionPayload {
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'bimonthly';
  items: { productId: number; quantity: number }[];
  deliveryMethod?: string;
  deliveryCity?: string;
  deliveryAddress?: string;
  paymentMethod?: string;
}

export function useCreateSubscription() {
  const { mutate } = useSubscriptions();

  const createSubscription = async (payload: CreateSubscriptionPayload) => {
    const res = await apiClient.post<Subscription>('/api/v1/me/subscriptions', payload);
    if (res.success) {
      await mutate();
    }
    return res;
  };

  return { createSubscription };
}

export function usePauseSubscription() {
  const { mutate } = useSubscriptions();

  const pauseSubscription = async (id: number) => {
    const res = await apiClient.patch<Subscription>(`/api/v1/me/subscriptions/${id}`, {
      status: 'paused',
    });
    if (res.success) {
      await mutate();
    }
    return res;
  };

  return { pauseSubscription };
}

export function useResumeSubscription() {
  const { mutate } = useSubscriptions();

  const resumeSubscription = async (id: number) => {
    const res = await apiClient.patch<Subscription>(`/api/v1/me/subscriptions/${id}`, {
      status: 'active',
    });
    if (res.success) {
      await mutate();
    }
    return res;
  };

  return { resumeSubscription };
}

export function useCancelSubscription() {
  const { mutate } = useSubscriptions();

  const cancelSubscription = async (id: number) => {
    const res = await apiClient.delete<Subscription>(`/api/v1/me/subscriptions/${id}`);
    if (res.success) {
      await mutate();
    }
    return res;
  };

  return { cancelSubscription };
}
