import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cacheGet, cacheSet, CACHE_TTL } from '@/services/cache';

export interface TenantContext {
  id: number;
  slug: string;
  domain: string | null;
  plan: string;
  settings: Record<string, unknown> | null;
}

const TENANT_CACHE_PREFIX = 'tenant';

/**
 * Resolve tenant from request hostname.
 * Resolution order:
 *   1. Subdomain pattern: {slug}.{baseDomain} -> resolve by slug
 *   2. Custom domain: full hostname -> resolve by domain
 *   3. No match -> null (default tenant / single-store mode)
 */
export async function getTenantFromRequest(request: NextRequest): Promise<TenantContext | null> {
  const hostname =
    request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!hostname) return null;

  // Strip port for matching
  const host = hostname.split(':')[0];

  // 1. Check subdomain pattern against APP_URL base domain
  const baseDomain = getBaseDomain();
  if (baseDomain && host.endsWith(`.${baseDomain}`)) {
    const slug = host.replace(`.${baseDomain}`, '');
    if (slug && !slug.includes('.')) {
      return getTenantBySlug(slug);
    }
  }

  // 2. Check custom domain (skip localhost / base domain itself)
  if (baseDomain && host === baseDomain) return null;
  if (host === 'localhost' || host === '127.0.0.1') return null;

  return getTenantByDomain(host);
}

/** Get tenant by slug, cached in Redis for 5 minutes. */
export async function getTenantBySlug(slug: string): Promise<TenantContext | null> {
  const cacheKey = `${TENANT_CACHE_PREFIX}:slug:${slug}`;
  const cached = await cacheGet<TenantContext>(cacheKey);
  if (cached) return cached;

  const tenant = await prisma.tenant.findUnique({
    where: { slug, isActive: true },
    select: { id: true, slug: true, domain: true, plan: true, settings: true },
  });

  if (!tenant) return null;

  const ctx: TenantContext = {
    id: tenant.id,
    slug: tenant.slug,
    domain: tenant.domain,
    plan: tenant.plan,
    settings: tenant.settings as Record<string, unknown> | null,
  };

  await cacheSet(cacheKey, ctx, CACHE_TTL.MEDIUM);
  return ctx;
}

/** Get tenant by custom domain, cached in Redis for 5 minutes. */
export async function getTenantByDomain(domain: string): Promise<TenantContext | null> {
  const cacheKey = `${TENANT_CACHE_PREFIX}:domain:${domain}`;
  const cached = await cacheGet<TenantContext>(cacheKey);
  if (cached) return cached;

  const tenant = await prisma.tenant.findUnique({
    where: { domain, isActive: true },
    select: { id: true, slug: true, domain: true, plan: true, settings: true },
  });

  if (!tenant) return null;

  const ctx: TenantContext = {
    id: tenant.id,
    slug: tenant.slug,
    domain: tenant.domain,
    plan: tenant.plan,
    settings: tenant.settings as Record<string, unknown> | null,
  };

  await cacheSet(cacheKey, ctx, CACHE_TTL.MEDIUM);
  return ctx;
}

/** Extract base domain from APP_URL environment variable. */
function getBaseDomain(): string | null {
  const appUrl = process.env.APP_URL;
  if (!appUrl) return null;
  try {
    return new URL(appUrl).hostname;
  } catch {
    return null;
  }
}
