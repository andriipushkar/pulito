'use client';

import { useContext } from 'react';
import { SettingsContext } from '@/providers/SettingsProvider';
import { DEFAULT_SETTINGS, type SiteSettings } from '@/types/settings';

export function useSettings(): SiteSettings {
  const ctx = useContext(SettingsContext);
  return ctx ?? DEFAULT_SETTINGS;
}
