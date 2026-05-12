'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Spinner from '@/components/ui/Spinner';

// Lands here after the server-side /api/v1/auth/google/callback finishes —
// the refresh_token cookie is already set. AuthProvider's mount-effect issues
// the single /api/v1/auth/refresh that populates user state; we just wait for
// it and redirect. Doing our own fetch here used to race with that refresh
// and trip the refresh-token-reuse detector.
export default function AuthCallbackPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      router.replace('/');
    } else {
      router.replace('/auth/login?error=oauth_failed');
    }
  }, [isLoading, user, router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner size="md" />
    </div>
  );
}
