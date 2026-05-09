'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setAccessToken } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import Spinner from '@/components/ui/Spinner';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { refreshAuth } = useAuth();

  useEffect(() => {
    fetch('/api/v1/auth/oauth-exchange', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
      .then((res) => res.json())
      .then(async (data) => {
        if (data.success && data.data?.accessToken) {
          setAccessToken(data.data.accessToken);
          // The AuthProvider already mounted before OAuth started; without this
          // its `user` state stays null and the storefront still sees us as
          // logged out.
          await refreshAuth();
          router.replace('/');
        } else {
          router.replace('/auth/login?error=oauth_exchange_failed');
        }
      })
      .catch(() => {
        router.replace('/auth/login?error=oauth_exchange_failed');
      });
  }, [router, refreshAuth]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner size="md" />
    </div>
  );
}
