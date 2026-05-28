'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { MARKETPLACES } from '../_shared';

interface Settings {
  enabled: boolean;
  windowDays: number;
  excludePlatforms: string[];
}

export function AutoCrosslistSettings() {
  const t = useTranslations('admin.autoCrosslistSettings');
  const [settings, setSettings] = useState<Settings>({
    enabled: false,
    windowDays: 7,
    excludePlatforms: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    apiClient.get<Settings>('/api/v1/admin/marketplaces/auto-crosslist').then((r) => {
      if (r.success && r.data) setSettings(r.data);
      setLoading(false);
    });
  }, []);

  const togglePlatform = (key: string) => {
    setSettings((prev) => {
      const isExcluded = prev.excludePlatforms.includes(key);
      return {
        ...prev,
        excludePlatforms: isExcluded
          ? prev.excludePlatforms.filter((p) => p !== key)
          : [...prev.excludePlatforms, key],
      };
    });
  };

  const save = async () => {
    setSaving(true);
    const r = await apiClient.put('/api/v1/admin/marketplaces/auto-crosslist', settings);
    if (r.success) toast.success(t('saved'));
    else toast.error(r.error || t('error'));
    setSaving(false);
  };

  const runNow = async () => {
    setRunning(true);
    const r = await apiClient.post<{ scanned: number; published: number; errors: number }>(
      '/api/v1/admin/marketplaces/auto-crosslist',
    );
    if (r.success && r.data) {
      toast.success(
        t('runResult', {
          scanned: r.data.scanned,
          published: r.data.published,
          errors: r.data.errors,
        }),
      );
    } else {
      toast.error(r.error || t('error'));
    }
    setRunning(false);
  };

  if (loading) return null;

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
          className="h-4 w-4 accent-[var(--color-primary)]"
        />
        <span className="text-sm font-medium">{t('enableLabel')}</span>
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-2 text-sm">
          <span>{t('windowLabel')}</span>
          <Input
            type="number"
            min={1}
            max={90}
            value={String(settings.windowDays)}
            onChange={(e) => setSettings({ ...settings, windowDays: Number(e.target.value) })}
            className="w-20"
          />
          <span className="text-xs text-[var(--color-text-secondary)]">{t('windowRange')}</span>
        </label>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
          {t('excludeLabel')}
        </p>
        <div className="flex flex-wrap gap-3">
          {MARKETPLACES.map((m) => {
            const excluded = settings.excludePlatforms.includes(m.key);
            return (
              <label key={m.key} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={excluded}
                  onChange={() => togglePlatform(m.key)}
                  className="accent-[var(--color-primary)]"
                />
                <span>
                  {m.icon} {m.name}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={save} isLoading={saving}>
          {t('save')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={runNow}
          isLoading={running}
          disabled={!settings.enabled}
          title={!settings.enabled ? t('runDisabledTitle') : t('runTitle')}
        >
          {t('runNow')}
        </Button>
      </div>

      <p className="text-[10px] text-[var(--color-text-secondary)]">
        {t.rich('cronNote', {
          code: (chunks) => <code>{chunks}</code>,
        })}
      </p>
    </div>
  );
}
