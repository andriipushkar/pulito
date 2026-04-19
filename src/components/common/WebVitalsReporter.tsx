'use client';

import { useEffect } from 'react';

function sendMetric(name: string, value: number) {
  const body = JSON.stringify({
    route: window.location.pathname,
    metric: name,
    value,
    timestamp: Date.now(),
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/v1/metrics', body);
  } else {
    fetch('/api/v1/metrics', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      keepalive: true,
    }).catch(() => {});
  }
}

export default function WebVitalsReporter() {
  useEffect(() => {
    // web-vitals v5 dropped onFID in favor of onINP (Interaction to Next Paint)
    import('web-vitals')
      .then(({ onCLS, onLCP, onINP, onTTFB, onFCP }) => {
        onLCP((metric: { value: number }) => sendMetric('LCP', metric.value));
        onCLS((metric: { value: number }) => sendMetric('CLS', metric.value));
        onINP((metric: { value: number }) => sendMetric('INP', metric.value));
        onTTFB((metric: { value: number }) => sendMetric('TTFB', metric.value));
        onFCP((metric: { value: number }) => sendMetric('FCP', metric.value));
      })
      .catch(() => {
        // web-vitals not available — silent fallback
      });
  }, []);

  return null;
}
