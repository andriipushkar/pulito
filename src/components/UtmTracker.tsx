'use client';

import { useEffect } from 'react';
import { captureUtmsFromUrl } from '@/lib/utm';

export default function UtmTracker() {
  useEffect(() => {
    captureUtmsFromUrl();
  }, []);
  return null;
}
