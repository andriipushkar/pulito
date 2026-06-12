import { promises as dns } from 'dns';
import { env } from '@/config/env';
import { getNovaPoshtaCreds, getLiqPayCreds } from '@/services/integration-credentials';
import { prisma } from '@/lib/prisma';
import { notifyManagerHealthAlert } from '@/services/telegram';

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
    // Nova Poshta — credentials come from the admin panel (DB), env fallback,
    // same resolution the delivery code uses (getNovaPoshtaCreds).
    checkService('nova_poshta', async () => {
      const { apiKey } = await getNovaPoshtaCreds();
      if (!apiKey) throw new Error('API key not configured');
      const res = await fetch('https://api.novaposhta.ua/v2.0/json/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
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
      await dns.resolve(env.SMTP_HOST);
    }),
  ]);

  // Alert the manager in Telegram, but ONLY on state transitions (down /
  // recovered) — the cron fires hourly and a permanently-down service must
  // not spam a message every hour. Last known state lives in site_settings.
  await notifyOnTransitions(results).catch(() => undefined);

  return {
    results,
    allHealthy: results.every((r) => r.status === 'ok'),
  };
}

const STATE_KEY = 'health_check_last_state';

async function notifyOnTransitions(results: HealthCheckResult[]): Promise<void> {
  let prev: Record<string, 'ok' | 'error'> = {};
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: STATE_KEY } });
    if (row?.value) prev = JSON.parse(row.value) as Record<string, 'ok' | 'error'>;
  } catch {
    // No previous state — treat this run as the baseline.
  }

  const next: Record<string, 'ok' | 'error'> = {};
  const changes: { service: string; status: 'ok' | 'error'; error?: string }[] = [];
  for (const r of results) {
    next[r.service] = r.status;
    // Unknown previous state: record silently, don't alert — otherwise the
    // very first run after deploy fires "recovered" for every healthy service.
    if (prev[r.service] && prev[r.service] !== r.status) {
      changes.push({ service: r.service, status: r.status, error: r.error });
    }
  }

  await prisma.siteSetting.upsert({
    where: { key: STATE_KEY },
    update: { value: JSON.stringify(next) },
    create: { key: STATE_KEY, value: JSON.stringify(next) },
  });

  if (changes.length > 0) {
    await notifyManagerHealthAlert(changes);
  }
}
