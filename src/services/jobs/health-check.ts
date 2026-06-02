import { env } from '@/config/env';

interface HealthCheckResult {
  service: string;
  status: 'ok' | 'error';
  latencyMs: number;
  error?: string;
}

async function checkService(
  name: string,
  checkFn: () => Promise<void>,
): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    await checkFn();
    return { service: name, status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    return {
      service: name,
      status: 'error',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Check health of external services: Nova Poshta API, LiqPay, SMTP.
 */
export async function runHealthChecks(): Promise<{
  results: HealthCheckResult[];
  allHealthy: boolean;
}> {
  const results = await Promise.all([
    // Nova Poshta API
    checkService('nova_poshta', async () => {
      if (!env.NOVA_POSHTA_API_KEY) throw new Error('API key not configured');
      const res = await fetch('https://api.novaposhta.ua/v2.0/json/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: env.NOVA_POSHTA_API_KEY,
          modelName: 'Common',
          calledMethod: 'getTimeIntervals',
          methodProperties: {},
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }),

    // LiqPay — credentials come from the admin panel (DB), not env.
    checkService('liqpay', async () => {
      const { getLiqPayCreds } = await import('@/services/integration-credentials');
      const { publicKey } = await getLiqPayCreds();
      if (!publicKey) throw new Error('Public key not configured');
      const res = await fetch('https://www.liqpay.ua/api/request', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok && res.status !== 405) throw new Error(`HTTP ${res.status}`);
    }),

    // SMTP
    checkService('smtp', async () => {
      if (!env.SMTP_HOST || !env.SMTP_USER) throw new Error('SMTP not configured');
      // DNS resolution check for SMTP host
      const { promises: dns } = await import('dns');
      await dns.resolve(env.SMTP_HOST);
    }),
  ]);

  return {
    results,
    allHealthy: results.every((r) => r.status === 'ok'),
  };
}
