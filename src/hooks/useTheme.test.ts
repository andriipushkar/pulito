// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockContextValue = {
  theme: { id: 1, displayName: 'Default', cssVariables: { '--primary': '#2563eb' } },
  isLoading: false,
  refreshTheme: vi.fn(),
};

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useContext: vi.fn(() => mockContextValue),
  };
});

vi.mock('@/providers/ThemeProvider', () => ({
  ThemeContext: {},
}));

import { useTheme } from './useTheme';

describe('useTheme', () => {
  it('returns theme context value', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current).toBeDefined();
    expect(result.current.theme).toEqual({
      id: 1,
      displayName: 'Default',
      cssVariables: { '--primary': '#2563eb' },
    });
  });

  it('returns isLoading state', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.isLoading).toBe(false);
  });

  it('returns refreshTheme function', () => {
    const { result } = renderHook(() => useTheme());
    expect(typeof result.current.refreshTheme).toBe('function');
  });
});
