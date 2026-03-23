// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { DEFAULT_SETTINGS } from '@/types/settings';

vi.mock('@/providers/SettingsProvider', () => ({
  SettingsContext: React.createContext(null),
}));

import { useSettings } from './useSettings';

describe('useSettings', () => {
  it('returns default settings when outside provider', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current).toEqual(DEFAULT_SETTINGS);
  });

  it('returns default site_name', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.site_name).toBe('Порошок');
  });

  it('returns default site_email', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.site_email).toBe('info@poroshok.ua');
  });

  it('returns default free_delivery_threshold', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.free_delivery_threshold).toBe('2000');
  });

  it('returns all default settings keys', () => {
    const { result } = renderHook(() => useSettings());

    const keys = Object.keys(result.current);
    expect(keys).toContain('site_name');
    expect(keys).toContain('site_phone');
    expect(keys).toContain('site_email');
    expect(keys).toContain('maintenance_mode');
    expect(keys).toContain('google_analytics_id');
  });
});
