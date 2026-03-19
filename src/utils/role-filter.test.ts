import { describe, it, expect } from 'vitest';
import { filterByRole, filterArrayByRole } from './role-filter';

describe('filterByRole', () => {
  const fullData = {
    id: 1,
    name: 'John',
    email: 'john@test.com',
    passwordHash: 'secret_hash',
    twoFactorSecret: 'totp_secret',
    googleId: 'google_123',
    ipAddress: '192.168.1.1',
    deviceInfo: 'Chrome/120',
    telegramChatId: '12345',
    viberUserId: '67890',
  };

  it('returns all fields for admin role', () => {
    const result = filterByRole(fullData, 'admin');
    expect(result).toEqual(fullData);
    expect(result).toBe(fullData); // same reference, no copy
  });

  it('removes admin-only fields for client role', () => {
    const result = filterByRole(fullData, 'client');

    expect(result.id).toBe(1);
    expect(result.name).toBe('John');
    expect(result.email).toBe('john@test.com');
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('twoFactorSecret');
    expect(result).not.toHaveProperty('googleId');
    expect(result).not.toHaveProperty('ipAddress');
    expect(result).not.toHaveProperty('deviceInfo');
    expect(result).not.toHaveProperty('telegramChatId');
    expect(result).not.toHaveProperty('viberUserId');
  });

  it('removes admin-only fields for manager role', () => {
    const result = filterByRole(fullData, 'manager');
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('twoFactorSecret');
  });

  it('removes admin-only fields for wholesaler role', () => {
    const result = filterByRole(fullData, 'wholesaler');
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('googleId');
  });

  it('does not modify original object for non-admin roles', () => {
    const original = { ...fullData };
    filterByRole(fullData, 'client');
    expect(fullData).toEqual(original);
  });

  it('handles data without admin-only fields gracefully', () => {
    const simpleData = { id: 1, name: 'John' };
    const result = filterByRole(simpleData, 'client');
    expect(result).toEqual({ id: 1, name: 'John' });
  });

  it('handles empty object', () => {
    const result = filterByRole({} as Record<string, unknown>, 'client');
    expect(result).toEqual({});
  });
});

describe('filterArrayByRole', () => {
  const items = [
    { id: 1, name: 'Alice', passwordHash: 'hash1', telegramChatId: '111' },
    { id: 2, name: 'Bob', passwordHash: 'hash2', googleId: 'g2' },
  ];

  it('returns all items unchanged for admin role', () => {
    const result = filterArrayByRole(items, 'admin');
    expect(result).toBe(items); // same reference
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('passwordHash');
  });

  it('filters admin-only fields from all items for client role', () => {
    const result = filterArrayByRole(items, 'client');

    expect(result).toHaveLength(2);
    expect(result[0]).not.toHaveProperty('passwordHash');
    expect(result[0]).not.toHaveProperty('telegramChatId');
    expect(result[0].name).toBe('Alice');
    expect(result[1]).not.toHaveProperty('passwordHash');
    expect(result[1]).not.toHaveProperty('googleId');
    expect(result[1].name).toBe('Bob');
  });

  it('handles empty array', () => {
    const result = filterArrayByRole([], 'client');
    expect(result).toEqual([]);
  });
});
