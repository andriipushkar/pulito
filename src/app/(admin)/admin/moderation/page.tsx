'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface ModerationRule {
  id: number;
  platform: string;
  ruleType: string;
  config: Record<string, unknown>;
  action: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ModerationLog {
  id: number;
  platform: string;
  userPlatformId: string;
  userName: string | null;
  ruleId: number | null;
  originalMessage: string | null;
  actionTaken: string;
  isFalsePositive: boolean;
  createdAt: string;
  rule?: { ruleType: string } | null;
}

type TabKey = 'rules' | 'logs';

const PLATFORMS = [
  { value: '', label: 'Всі платформи' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'viber', label: 'Viber' },
];

const RULE_TYPES = [
  { value: 'stop_words', label: 'Стоп-слова' },
  { value: 'link_block', label: 'Блокування посилань' },
  { value: 'flood_limit', label: 'Обмеження флуду' },
];

const ACTIONS = [
  { value: 'delete', label: 'Видалити' },
  { value: 'warn', label: 'Попередити' },
  { value: 'ban', label: 'Заблокувати' },
];

const ACTION_COLORS: Record<string, string> = {
  delete: 'bg-red-100 text-red-700',
  warn: 'bg-amber-100 text-amber-700',
  ban: 'bg-red-200 text-red-800',
};

export default function AdminModerationPage() {
  const [tab, setTab] = useState<TabKey>('rules');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">Модерація</h2>
      </div>

      <div className="mb-6 flex gap-1 rounded-[var(--radius)] bg-[var(--color-bg-secondary)] p-1">
        <button
          onClick={() => setTab('rules')}
          className={`rounded-[var(--radius)] px-4 py-2 text-sm font-medium transition-colors ${tab === 'rules' ? 'bg-[var(--color-bg)] shadow-sm' : 'text-[var(--color-text-secondary)]'}`}
        >
          Правила
        </button>
        <button
          onClick={() => setTab('logs')}
          className={`rounded-[var(--radius)] px-4 py-2 text-sm font-medium transition-colors ${tab === 'logs' ? 'bg-[var(--color-bg)] shadow-sm' : 'text-[var(--color-text-secondary)]'}`}
        >
          Журнал модерації
        </button>
      </div>

      {tab === 'rules' ? <RulesTab /> : <LogsTab />}
    </div>
  );
}

function RulesTab() {
  const [rules, setRules] = useState<ModerationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingRule, setEditingRule] = useState<ModerationRule | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [formPlatform, setFormPlatform] = useState('telegram');
  const [formRuleType, setFormRuleType] = useState('stop_words');
  const [formAction, setFormAction] = useState('delete');
  const [formConfig, setFormConfig] = useState('{}');
  const [isSaving, setIsSaving] = useState(false);

  const loadRules = useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (platformFilter) params.set('platform', platformFilter);
    apiClient
      .get<ModerationRule[]>(`/api/v1/admin/moderation/rules?${params}`)
      .then((res) => { if (res.success && res.data) setRules(res.data); })
      .finally(() => setIsLoading(false));
  }, [platformFilter]);

  useEffect(() => { loadRules(); }, [loadRules]);

  const resetForm = () => {
    setFormPlatform('telegram');
    setFormRuleType('stop_words');
    setFormAction('delete');
    setFormConfig('{}');
  };

  const openEdit = (rule: ModerationRule) => {
    setEditingRule(rule);
    setFormPlatform(rule.platform);
    setFormRuleType(rule.ruleType);
    setFormAction(rule.action);
    setFormConfig(JSON.stringify(rule.config, null, 2));
    setShowCreate(false);
  };

  const handleSave = async () => {
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(formConfig);
    } catch {
      return;
    }

    setIsSaving(true);
    try {
      const payload = { platform: formPlatform, ruleType: formRuleType, action: formAction, config };

      if (editingRule) {
        const res = await apiClient.put(`/api/v1/admin/moderation/rules/${editingRule.id}`, payload);
        if (res.success) { setEditingRule(null); loadRules(); }
      } else {
        const res = await apiClient.post('/api/v1/admin/moderation/rules', payload);
        if (res.success) { setShowCreate(false); resetForm(); loadRules(); }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (rule: ModerationRule) => {
    await apiClient.put(`/api/v1/admin/moderation/rules/${rule.id}`, { isActive: !rule.isActive });
    loadRules();
  };

  const executeDelete = async () => {
    if (!deleteId) return;
    await apiClient.delete(`/api/v1/admin/moderation/rules/${deleteId}`);
    setDeleteId(null);
    loadRules();
  };

  const getConfigHint = (ruleType: string) => {
    switch (ruleType) {
      case 'stop_words': return '{"words": ["слово1", "слово2"]}';
      case 'link_block': return '{"allowDomains": ["example.com"]}';
      case 'flood_limit': return '{"maxMessages": 5, "periodSeconds": 60}';
      default: return '{}';
    }
  };

  if (isLoading) return <div className="flex justify-center py-8"><Spinner size="md" /></div>;

  const formPanel = (showCreate || editingRule) && (
    <div className="mb-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <h3 className="mb-3 text-sm font-semibold">{editingRule ? 'Редагувати правило' : 'Нове правило'}</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium">Платформа</label>
          <select value={formPlatform} onChange={(e) => setFormPlatform(e.target.value)} className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm">
            <option value="telegram">Telegram</option>
            <option value="viber">Viber</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Тип правила</label>
          <select value={formRuleType} onChange={(e) => setFormRuleType(e.target.value)} className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm">
            {RULE_TYPES.map((rt) => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Дія</label>
          <select value={formAction} onChange={(e) => setFormAction(e.target.value)} className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm">
            {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-4">
        <label className="mb-1 block text-xs font-medium">Конфігурація (JSON)</label>
        <textarea
          value={formConfig}
          onChange={(e) => setFormConfig(e.target.value)}
          rows={3}
          className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--color-primary)]"
        />
        <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">Приклад: {getConfigHint(formRuleType)}</p>
      </div>
      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={handleSave} isLoading={isSaving}>{editingRule ? 'Зберегти' : 'Створити'}</Button>
        <Button size="sm" variant="outline" onClick={() => { setShowCreate(false); setEditingRule(null); resetForm(); }}>Скасувати</Button>
      </div>
    </div>
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm">
          {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        {!showCreate && !editingRule && (
          <Button size="sm" onClick={() => { setShowCreate(true); resetForm(); }}>+ Нове правило</Button>
        )}
      </div>

      {formPanel}

      <div className="space-y-2">
        {rules.map((rule) => (
          <div key={rule.id} className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-xs font-medium">{rule.platform}</span>
                <span className="text-sm font-medium">{RULE_TYPES.find((rt) => rt.value === rule.ruleType)?.label || rule.ruleType}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[rule.action] || 'bg-gray-100'}`}>
                  {ACTIONS.find((a) => a.value === rule.action)?.label || rule.action}
                </span>
              </div>
              <p className="mt-1 max-w-md truncate text-xs text-[var(--color-text-secondary)]">{JSON.stringify(rule.config)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handleToggle(rule)} className={`rounded-full px-2 py-0.5 text-xs font-medium ${rule.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                {rule.isActive ? 'Активне' : 'Вимкнене'}
              </button>
              <button onClick={() => openEdit(rule)} className="text-xs text-[var(--color-primary)] hover:underline">Редагувати</button>
              <button onClick={() => setDeleteId(rule.id)} className="text-xs text-[var(--color-danger)] hover:underline">Видалити</button>
            </div>
          </div>
        ))}
        {rules.length === 0 && (
          <div className="py-8 text-center text-[var(--color-text-secondary)]">Правил модерації немає</div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={executeDelete}
        title="Видалення правила"
        message="Видалити це правило модерації? Цю дію неможливо скасувати."
        confirmText="Видалити"
        variant="danger"
      />
    </>
  );
}

function LogsTab() {
  const [logs, setLogs] = useState<ModerationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [platformFilter, setPlatformFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const limit = 20;

  useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (platformFilter) params.set('platform', platformFilter);
    if (actionFilter) params.set('actionTaken', actionFilter);

    apiClient
      .get<ModerationLog[]>(`/api/v1/admin/moderation/logs?${params}`)
      .then((res) => {
        if (res.success && res.data) {
          setLogs(res.data);
          setTotal((res as unknown as { pagination?: { total: number } }).pagination?.total || 0);
        }
      })
      .finally(() => setIsLoading(false));
  }, [page, platformFilter, actionFilter]);

  const markFalsePositive = async (logId: number) => {
    await apiClient.patch(`/api/v1/admin/moderation/logs`, { logId, isFalsePositive: true });
    setLogs((prev) => prev.map((l) => l.id === logId ? { ...l, isFalsePositive: true } : l));
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (isLoading) return <div className="flex justify-center py-8"><Spinner size="md" /></div>;

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={platformFilter} onChange={(e) => { setPlatformFilter(e.target.value); setPage(1); }} className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm">
          {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm">
          <option value="">Всі дії</option>
          {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-secondary)]">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Дата</th>
              <th className="px-4 py-2 text-left font-medium">Платформа</th>
              <th className="px-4 py-2 text-left font-medium">Користувач</th>
              <th className="px-4 py-2 text-left font-medium">Повідомлення</th>
              <th className="px-4 py-2 text-left font-medium">Правило</th>
              <th className="px-4 py-2 text-left font-medium">Дія</th>
              <th className="px-4 py-2 text-left font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className={`border-t border-[var(--color-border)] ${log.isFalsePositive ? 'bg-yellow-50/50' : ''}`}>
                <td className="px-4 py-2 text-xs whitespace-nowrap">{formatDate(log.createdAt)}</td>
                <td className="px-4 py-2 text-xs">
                  <span className="rounded bg-[var(--color-bg-secondary)] px-1.5 py-0.5 text-xs">{log.platform}</span>
                </td>
                <td className="px-4 py-2 text-xs">{log.userName || log.userPlatformId}</td>
                <td className="px-4 py-2 text-xs max-w-[200px] truncate">{log.originalMessage || '—'}</td>
                <td className="px-4 py-2 text-xs">{log.rule?.ruleType ? (RULE_TYPES.find((rt) => rt.value === log.rule?.ruleType)?.label || log.rule.ruleType) : '—'}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[log.actionTaken] || 'bg-gray-100'}`}>
                    {ACTIONS.find((a) => a.value === log.actionTaken)?.label || log.actionTaken}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  {log.isFalsePositive ? (
                    <span className="text-xs text-amber-600">Хибне спрацювання</span>
                  ) : (
                    <button onClick={() => markFalsePositive(log.id)} className="text-xs text-[var(--color-text-secondary)] hover:underline">
                      Хибне?
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">Записів немає</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {total > limit && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Попередня</Button>
          <span className="text-sm text-[var(--color-text-secondary)]">Стор. {page} з {Math.ceil(total / limit)}</span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(page + 1)}>Наступна</Button>
        </div>
      )}
    </>
  );
}
