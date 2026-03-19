'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setAccessToken } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Exchange the one-time httpOnly cookie for an access token
    fetch('/api/v1/auth/oauth-exchange', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.accessToken) {
          setAccessToken(data.data.accessToken);
          router.replace('/');
        } else {
          // Token exchange failed — redirect to login with error
          router.replace('/auth/login?error=oauth_exchange_failed');
        }
      })
      .catch(() => {
        router.replace('/auth/login?error=oauth_exchange_failed');
      });
  }, [router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner size="md" />
    </div>
  );
}
