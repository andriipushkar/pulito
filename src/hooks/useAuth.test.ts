// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/providers/AuthProvider', () => ({
  AuthContext: {
    Provider: ({ children }: { children: React.ReactNode }) => children,
    Consumer: undefined,
    displayName: 'AuthContext',
    _currentValue: {
      user: { id: 1, email: 'test@test.com', role: 'client', fullName: 'Test' },
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    },
  },
}));

// Mock React.useContext to return our mocked value
const mockContextValue = {
  user: { id: 1, email: 'test@test.com', role: 'client', fullName: 'Test' },
  isLoading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
};

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useContext: vi.fn(() => mockContextValue),
  };
});

import { useAuth } from './useAuth';

describe('useAuth', () => {
  it('returns auth context value', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current).toBeDefined();
    expect(result.current.user).toEqual({
      id: 1,
      email: 'test@test.com',
      role: 'client',
      fullName: 'Test',
    });
  });

  it('returns isLoading state', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  it('returns login function', () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.login).toBe('function');
  });

  it('returns register function', () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.register).toBe('function');
  });

  it('returns logout function', () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.logout).toBe('function');
  });
});
