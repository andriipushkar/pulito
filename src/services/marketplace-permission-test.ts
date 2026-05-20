import { getChannelConfig, type MarketplaceConfig } from '@/services/channel-config';
import type { MarketplacePlatform } from '@/services/marketplace-health';
import { recordMarketplaceCall } from '@/services/marketplace-rate-limit';
import { marketplaceLogger } from '@/services/marketplace-logger';

const log = marketplaceLogger('perm-test');

export type PermissionKey = 'products.read' | 'products.write' | 'orders.read' | 'messages.send';

export interface PermissionResult {
  permission: PermissionKey;
  status: 'ok' | 'denied' | 'error' | 'untested';
  error?: string;
  /** Probe was inherently read-only (no risk of changing data). */
  readOnly: boolean;
}

interface Probe {
  permission: PermissionKey;
  readOnly: boolean;
  run: (config: MarketplaceConfig) => Promise<{ ok: boolean; error?: string; denied?: boolean }>;
}

function makeOlxProbes(): Probe[] {
  return [
    {
      permission: 'products.read',
      readOnly: true,
      run: async (c) => {
        const res = await fetch('https://www.olx.ua/api/partner/adverts?limit=1', {
          headers: { Authorization: `Bearer ${String(c.accessToken)}`, Version: '2.0' },
          signal: AbortSignal.timeout(10000),
        });
        if (res.status === 403) return { ok: false, denied: true, error: 'Немає scope read' };
        return { ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
      },
    },
    {
      permission: 'orders.read',
      readOnly: true,
      run: async (c) => {
        const res = await fetch('https://www.olx.ua/api/partner/orders?limit=1', {
          headers: { Authorization: `Bearer ${String(c.accessToken)}`, Version: '2.0' },
          signal: AbortSignal.timeout(10000),
        });
        if (res.status === 403) return { ok: false, denied: true, error: 'Немає scope orders' };
        return { ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
      },
    },
    {
      permission: 'messages.send',
      readOnly: true,
      run: async (c) => {
        const res = await fetch('https://www.olx.ua/api/partner/threads?limit=1', {
          headers: { Authorization: `Bearer ${String(c.accessToken)}`, Version: '2.0' },
          signal: AbortSignal.timeout(10000),
        });
        if (res.status === 403) return { ok: false, denied: true, error: 'Немає scope messages' };
        return { ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
      },
    },
  ];
}

function makeRozetkaProbes(): Probe[] {
  return [
    {
      permission: 'products.read',
      readOnly: true,
      run: async (c) => {
        const res = await fetch('https://api-seller.rozetka.com.ua/items?per_page=1', {
          headers: { Authorization: `Bearer ${String(c.apiKey)}` },
          signal: AbortSignal.timeout(10000),
        });
        if (res.status === 403) return { ok: false, denied: true };
        return { ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
      },
    },
    {
      permission: 'orders.read',
      readOnly: true,
      run: async (c) => {
        const res = await fetch('https://api-seller.rozetka.com.ua/orders/search?limit=1', {
          headers: { Authorization: `Bearer ${String(c.apiKey)}` },
          signal: AbortSignal.timeout(10000),
        });
        if (res.status === 403) return { ok: false, denied: true };
        return { ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
      },
    },
  ];
}

function makePromProbes(): Probe[] {
  return [
    {
      permission: 'products.read',
      readOnly: true,
      run: async (c) => {
        const res = await fetch('https://my.prom.ua/api/v1/products/list?limit=1', {
          headers: { Authorization: `Bearer ${String(c.apiToken)}` },
          signal: AbortSignal.timeout(10000),
        });
        if (res.status === 403) return { ok: false, denied: true };
        return { ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
      },
    },
    {
      permission: 'orders.read',
      readOnly: true,
      run: async (c) => {
        const res = await fetch('https://my.prom.ua/api/v1/orders/list?limit=1', {
          headers: { Authorization: `Bearer ${String(c.apiToken)}` },
          signal: AbortSignal.timeout(10000),
        });
        if (res.status === 403) return { ok: false, denied: true };
        return { ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
      },
    },
  ];
}

function makeEpicentrProbes(): Probe[] {
  return [
    {
      permission: 'products.read',
      readOnly: true,
      run: async (c) => {
        const res = await fetch('https://marketplace.epicentrk.ua/api/v1/products?limit=1', {
          headers: { 'X-Api-Key': String(c.apiKey) },
          signal: AbortSignal.timeout(10000),
        });
        if (res.status === 403) return { ok: false, denied: true };
        return { ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
      },
    },
    {
      permission: 'orders.read',
      readOnly: true,
      run: async (c) => {
        const res = await fetch('https://marketplace.epicentrk.ua/api/v1/orders?limit=1', {
          headers: { 'X-Api-Key': String(c.apiKey) },
          signal: AbortSignal.timeout(10000),
        });
        if (res.status === 403) return { ok: false, denied: true };
        return { ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
      },
    },
  ];
}

function getProbes(platform: MarketplacePlatform): Probe[] {
  switch (platform) {
    case 'olx':
      return makeOlxProbes();
    case 'rozetka':
      return makeRozetkaProbes();
    case 'prom':
      return makePromProbes();
    case 'epicentrk':
      return makeEpicentrProbes();
  }
}

export async function testPermissions(
  platform: MarketplacePlatform,
): Promise<PermissionResult[]> {
  const config = (await getChannelConfig(platform)) as MarketplaceConfig | null;
  if (!config?.enabled) {
    return getProbes(platform).map((p) => ({
      permission: p.permission,
      status: 'untested' as const,
      error: 'Маркетплейс вимкнено',
      readOnly: p.readOnly,
    }));
  }

  const probes = getProbes(platform);
  return Promise.all(
    probes.map(async (probe): Promise<PermissionResult> => {
      try {
        recordMarketplaceCall(platform);
        const r = await probe.run(config);
        if (r.ok) return { permission: probe.permission, status: 'ok', readOnly: probe.readOnly };
        if (r.denied)
          return {
            permission: probe.permission,
            status: 'denied',
            error: r.error,
            readOnly: probe.readOnly,
          };
        return {
          permission: probe.permission,
          status: 'error',
          error: r.error,
          readOnly: probe.readOnly,
        };
      } catch (err) {
        log.error('probe error', {
          platform,
          permission: probe.permission,
          error: err instanceof Error ? err.message : String(err),
        });
        return {
          permission: probe.permission,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown',
          readOnly: probe.readOnly,
        };
      }
    }),
  );
}
