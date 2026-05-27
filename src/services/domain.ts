import { randomBytes } from 'crypto';
import dns from 'dns/promises';
import { prisma } from '@/lib/prisma';

export class DomainError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'DomainError';
    this.statusCode = statusCode;
  }
}

/**
 * Initiate domain verification — user must add TXT record.
 */
export async function initiateDomainVerification(
  tenantId: number,
  domain: string,
): Promise<{
  domain: string;
  verificationToken: string;
  txtRecordName: string;
}> {
  // Validate domain format
  const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  if (!domainRegex.test(domain)) {
    throw new DomainError('Невалідний формат домену');
  }

  // Check if domain is already taken by another tenant
  const existing = await prisma.tenant.findFirst({
    where: { domain, id: { not: tenantId } },
  });
  if (existing) {
    throw new DomainError('Цей домен вже використовується іншим магазином');
  }

  const verificationToken = `clean-verify-${randomBytes(16).toString('hex')}`;
  const txtRecordName = `_clean-verify.${domain}`;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      domain,
      domainVerified: false,
      domainVerificationToken: verificationToken,
    },
  });

  return { domain, verificationToken, txtRecordName };
}

/**
 * Check DNS TXT record for domain verification.
 */
export async function verifyDomain(tenantId: number, domain: string): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new DomainError('Тенант не знайдено', 404);
  }

  if (tenant.domain !== domain) {
    throw new DomainError('Домен не відповідає тенанту');
  }

  if (!tenant.domainVerificationToken) {
    throw new DomainError('Верифікація не ініційована');
  }

  const txtHost = `_clean-verify.${domain}`;
  const expectedToken = tenant.domainVerificationToken;

  // 5s DNS timeout — without it a hung resolver holds a request thread
  // indefinitely. dns.resolveTxt has no built-in timeout option; race it
  // against a manual timer.
  const lookup = (async (): Promise<{ verified: boolean; reason?: string }> => {
    try {
      const records = await dns.resolveTxt(txtHost);
      const flatRecords = records.map((r) => r.join(''));
      const verified = flatRecords.includes(expectedToken);
      if (!verified) {
        return {
          verified: false,
          reason: `TXT records found but none matched expected token (records: ${flatRecords.length})`,
        };
      }
      return { verified: true };
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? (err as { code: string }).code
          : 'unknown';
      return { verified: false, reason: `DNS error: ${code}` };
    }
  })();

  const result = await Promise.race<{ verified: boolean; reason?: string }>([
    lookup,
    new Promise<{ verified: false; reason: string }>((resolve) =>
      setTimeout(() => resolve({ verified: false, reason: 'DNS timeout 5s' }), 5000),
    ),
  ]);

  if (result.verified) {
    // Clear the verification token after success so an old token doesn't
    // hang around in DB forever — re-verification regenerates one.
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { domainVerified: true, domainVerificationToken: null },
    });
  } else if (result.reason) {
    console.warn(`[domain.verifyDomain] ${domain}: ${result.reason}`);
  }

  return result.verified;
}

/**
 * Map verified domain to tenant.
 */
export async function mapDomain(tenantId: number, domain: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new DomainError('Тенант не знайдено', 404);
  }

  if (tenant.domain !== domain || !tenant.domainVerified) {
    throw new DomainError('Домен не верифіковано');
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { domain, domainVerified: true },
  });
}

/**
 * Remove domain mapping.
 */
export async function removeDomain(tenantId: number): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      domain: null,
      domainVerified: false,
      domainVerificationToken: null,
    },
  });
}

/**
 * Resolve tenant from custom domain (used by tenant middleware).
 */
export async function resolveTenantByDomain(domain: string): Promise<number | null> {
  const tenant = await prisma.tenant.findFirst({
    where: {
      domain,
      domainVerified: true,
      isActive: true,
    },
    select: { id: true },
  });

  return tenant?.id ?? null;
}
