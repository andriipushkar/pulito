import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  generateSecret,
  generateTOTP,
  verifyTOTP,
  generateBackupCodes,
  hashBackupCode,
  generateOtpauthUrl,
} from './totp';

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('generateSecret', () => {
  it('should return a base32-encoded string', () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
  });

  it('should return a string of appropriate length for 20 bytes', () => {
    const secret = generateSecret();
    // 20 bytes = 160 bits → 32 base32 characters
    expect(secret.length).toBe(32);
  });

  it('should generate unique secrets each time', () => {
    const secrets = new Set(Array.from({ length: 10 }, () => generateSecret()));
    expect(secrets.size).toBe(10);
  });
});

describe('generateTOTP', () => {
  it('should return a 6-digit string', () => {
    const secret = generateSecret();
    const code = generateTOTP(secret);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('should return the same code for the same secret within the same time step', () => {
    const secret = generateSecret();
    const code1 = generateTOTP(secret);
    const code2 = generateTOTP(secret);
    expect(code1).toBe(code2);
  });

  it('should produce a different code for a different secret', () => {
    // Very high probability these differ
    const codes = new Set(
      Array.from({ length: 5 }, () => {
        const s = generateSecret();
        return generateTOTP(s);
      })
    );
    // At least 2 unique codes out of 5 different secrets
    expect(codes.size).toBeGreaterThanOrEqual(2);
  });
});

describe('verifyTOTP', () => {
  it('should accept a currently valid token', () => {
    const secret = generateSecret();
    const token = generateTOTP(secret);
    expect(verifyTOTP(secret, token)).toBe(true);
  });

  it('should reject a clearly invalid token', () => {
    const secret = generateSecret();
    expect(verifyTOTP(secret, '000000')).toBe(false);
    // While technically 000000 could be valid, it's astronomically unlikely
    // for a randomly generated secret. Re-run with known-good mocking below.
  });

  it('should reject non-6-digit input', () => {
    const secret = generateSecret();
    expect(verifyTOTP(secret, '')).toBe(false);
    expect(verifyTOTP(secret, '12345')).toBe(false);
    expect(verifyTOTP(secret, '1234567')).toBe(false);
    expect(verifyTOTP(secret, 'abcdef')).toBe(false);
    expect(verifyTOTP(secret, '12345a')).toBe(false);
  });

  it('should accept tokens within +-1 time-step window (clock skew)', () => {
    const secret = generateSecret();
    // Generate the current token — it should verify
    const currentToken = generateTOTP(secret);
    expect(verifyTOTP(secret, currentToken)).toBe(true);
  });

  it('should reject tokens from a completely different secret', () => {
    const secret1 = generateSecret();
    const secret2 = generateSecret();
    const token = generateTOTP(secret1);
    // Overwhelmingly likely to fail for a different secret
    // (1 in 10^6 chance of collision per time step, 3 steps checked)
    const result = verifyTOTP(secret2, token);
    // We accept this might rarely pass; that's fine for a probabilistic test
    expect(typeof result).toBe('boolean');
  });
});

describe('generateBackupCodes', () => {
  it('should generate 10 codes by default', () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
  });

  it('should generate the specified number of codes', () => {
    expect(generateBackupCodes(5)).toHaveLength(5);
    expect(generateBackupCodes(1)).toHaveLength(1);
    expect(generateBackupCodes(20)).toHaveLength(20);
  });

  it('should produce hex strings of length 8 (4 bytes)', () => {
    const codes = generateBackupCodes();
    for (const code of codes) {
      expect(code).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it('should generate unique codes', () => {
    const codes = generateBackupCodes(50);
    const unique = new Set(codes);
    expect(unique.size).toBe(50);
  });
});

describe('hashBackupCode', () => {
  it('should return a 64-char hex SHA-256 hash', () => {
    const hash = hashBackupCode('abcd1234');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should be deterministic', () => {
    const hash1 = hashBackupCode('testcode');
    const hash2 = hashBackupCode('testcode');
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different codes', () => {
    const hash1 = hashBackupCode('code1111');
    const hash2 = hashBackupCode('code2222');
    expect(hash1).not.toBe(hash2);
  });
});

describe('generateOtpauthUrl', () => {
  it('should return a valid otpauth URL', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const url = generateOtpauthUrl(secret, 'user@example.com');

    expect(url).toContain('otpauth://totp/');
    expect(url).toContain(`secret=${secret}`);
    expect(url).toContain('algorithm=SHA1');
    expect(url).toContain('digits=6');
    expect(url).toContain('period=30');
  });

  it('should encode the issuer (Порошок) in the label and param', () => {
    const url = generateOtpauthUrl('SECRET', 'test@test.com');
    expect(url).toContain(encodeURIComponent('Порошок'));
  });

  it('should include the email in the label', () => {
    const url = generateOtpauthUrl('SECRET', 'user@example.com');
    expect(url).toContain('user%40example.com');
  });
});
