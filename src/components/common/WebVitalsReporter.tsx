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
    // Dynamically import web-vitals to collect all Core Web Vitals
    import('web-vitals').then(({ onCLS, onFID, onLCP, onINP, onTTFB, onFCP }) => {
      onLCP((metric) => sendMetric('LCP', metric.value));
      onCLS((metric) => sendMetric('CLS', metric.value));
      onFID((metric) => sendMetric('FID', metric.value));
      onINP((metric) => sendMetric('INP', metric.value));
      onTTFB((metric) => sendMetric('TTFB', metric.value));
      onFCP((metric) => sendMetric('FCP', metric.value));
    }).catch(() => {
      // web-vitals not available — silent fallback
    });
  }, []);

  return null;
}
