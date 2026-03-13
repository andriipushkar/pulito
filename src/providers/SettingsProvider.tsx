'use client';

import { createContext, type ReactNode } from 'react';
import type { SiteSettings } from '@/types/settings';

export const SettingsContext = createContext<SiteSettings | null>(null);

export default function SettingsProvider({
  settings,
  children,
}: {
  settings: SiteSettings;
  children: ReactNode;
}) {
  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}
