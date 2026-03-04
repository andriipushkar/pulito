'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setAccessToken } from '@/lib/api-client';
import Spinner from '@/components/ui/Spinner';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');

    if (accessToken) {
      setAccessToken(accessToken);
    }

    router.replace('/');
  }, [searchParams, router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner size="md" />
    </div>
  );
}
