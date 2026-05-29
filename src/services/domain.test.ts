import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDnsResolveTxt = vi.fn();

vi.mock('dns/promises', () => ({
  default: { resolveTxt: (...args: unknown[]) => mockDnsResolveTxt(...args) },
  resolveTxt: (...args: unknown[]) => mockDnsResolveTxt(...args),
}));

const mockPrisma = vi.hoisted(() => ({
  tenant: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import {
  initiateDomainVerification,
  verifyDomain,
  mapDomain,
  removeDomain,
  resolveTenantByDomain,
} from './domain';

describe('domain service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initiateDomainVerification', () => {
    it('generates unique verification token', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await initiateDomainVerification(1, 'example.com');

      expect(result.domain).toBe('example.com');
      expect(result.verificationToken).toMatch(/^clean-verify-[a-f0-9]{32}$/);
      expect(result.txtRecordName).toBe('_clean-verify.example.com');
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          domain: 'example.com',
          domainVerified: false,
          domainVerificationToken: expect.stringMatching(/^clean-verify-/),
        },
      });
    });

    it('rejects invalid domain format', async () => {
      await expect(initiateDomainVerification(1, 'not a domain')).rejects.toThrow(
        'Невалідний формат домену',
      );
    });

    it('rejects domain already used by another tenant', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue({ id: 2 });

      await expect(initiateDomainVerification(1, 'example.com')).rejects.toThrow(
        'Цей домен вже використовується іншим магазином',
      );
    });
  });

  describe('verifyDomain', () => {
    it('verifies domain when DNS TXT record matches', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 1,
        domain: 'example.com',
        domainVerificationToken: 'clean-verify-abc123',
      });
      mockDnsResolveTxt.mockResolvedValue([['clean-verify-abc123']]);
      mockPrisma.tenant.update.mockResolvedValue({});

      const result = await verifyDomain(1, 'example.com');

      expect(result).toBe(true);
      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { domainVerified: true, domainVerificationToken: null },
      });
    });

    it('returns false when DNS record does not match', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 1,
        domain: 'example.com',
        domainVerificationToken: 'clean-verify-abc123',
      });
      mockDnsResolveTxt.mockResolvedValue([['wrong-token']]);

      const result = await verifyDomain(1, 'example.com');

      expect(result).toBe(false);
      expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
    });

    it('returns false when DNS resolution fails', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 1,
        domain: 'example.com',
        domainVerificationToken: 'clean-verify-abc123',
      });
      mockDnsResolveTxt.mockRejectedValue(new Error('ENOTFOUND'));

      const result = await verifyDomain(1, 'example.com');

      expect(result).toBe(false);
    });
  });

  describe('mapDomain', () => {
    it('maps verified domain to tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 1,
        domain: 'example.com',
        domainVerified: true,
      });
      mockPrisma.tenant.update.mockResolvedValue({});

      await mapDomain(1, 'example.com');

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { domain: 'example.com', domainVerified: true },
      });
    });

    it('rejects unverified domain', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 1,
        domain: 'example.com',
        domainVerified: false,
      });

      await expect(mapDomain(1, 'example.com')).rejects.toThrow('Домен не верифіковано');
    });
  });

  describe('removeDomain', () => {
    it('clears domain data', async () => {
      mockPrisma.tenant.update.mockResolvedValue({});

      await removeDomain(1);

      expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          domain: null,
          domainVerified: false,
          domainVerificationToken: null,
        },
      });
    });
  });

  describe('resolveTenantByDomain', () => {
    it('returns tenantId for verified active domain', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue({ id: 42 });

      const result = await resolveTenantByDomain('shop.example.com');

      expect(result).toBe(42);
      expect(mockPrisma.tenant.findFirst).toHaveBeenCalledWith({
        where: {
          domain: 'shop.example.com',
          domainVerified: true,
          isActive: true,
        },
        select: { id: true },
      });
    });

    it('returns null for unknown domain', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);

      const result = await resolveTenantByDomain('unknown.com');

      expect(result).toBeNull();
    });
  });
});
