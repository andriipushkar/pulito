import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, isEncrypted } from './encryption';

describe('encryption', () => {
  it('should encrypt and decrypt a string roundtrip', () => {
    const original = 'hello@example.com';
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it('should produce different ciphertexts for the same input', () => {
    const text = 'same-input';
    const a = encrypt(text);
    const b = encrypt(text);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(text);
    expect(decrypt(b)).toBe(text);
  });

  it('should handle empty string', () => {
    const encrypted = encrypt('');
    expect(decrypt(encrypted)).toBe('');
  });

  it('should handle unicode text', () => {
    const original = 'Привіт, світ! 🌍';
    const encrypted = encrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  it('should handle long strings', () => {
    const original = 'a'.repeat(10000);
    const encrypted = encrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted values', () => {
      const encrypted = encrypt('test');
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(isEncrypted('hello@example.com')).toBe(false);
      expect(isEncrypted('plain text')).toBe(false);
      expect(isEncrypted('')).toBe(false);
    });

    it('should return false for malformed encrypted strings', () => {
      expect(isEncrypted('abc:def:ghi')).toBe(false);
      expect(isEncrypted('not-hex:not-hex:not-hex')).toBe(false);
    });
  });
});
