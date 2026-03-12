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
        }
      })
      .catch(() => {})
      .finally(() => {
        router.replace('/');
      });
  }, [router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner size="md" />
    </div>
  );
}
