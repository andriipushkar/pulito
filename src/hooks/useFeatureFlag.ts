'use client';

import { useEffect, useState } from 'react';

interface UseFeatureFlagResult {
  isEnabled: boolean;
  isLoading: boolean;
}

export function useFeatureFlag(key: string): UseFeatureFlagResult {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/v1/feature-flags/check?key=${encodeURIComponent(key)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setIsEnabled(data.enabled === true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsEnabled(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return { isEnabled, isLoading };
}
