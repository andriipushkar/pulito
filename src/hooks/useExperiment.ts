'use client';

import { useEffect, useState } from 'react';

/**
 * Client-side hook for A/B experiments.
 * Assigns a consistent variant based on a cookie or generates one.
 */
export function useExperiment(experimentKey: string): {
  variant: string | null;
  isLoading: boolean;
} {
  const [variant, setVariant] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/v1/experiments/${experimentKey}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.data?.variant) {
          setVariant(data.data.variant);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [experimentKey]);

  return { variant, isLoading };
}
