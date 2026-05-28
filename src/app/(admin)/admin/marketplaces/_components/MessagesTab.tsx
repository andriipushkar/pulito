'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import AdminTableSkeleton from '@/components/admin/AdminTableSkeleton';
import { MARKETPLACES } from '../_shared';

interface MarketplaceMessage {
  id: string;
  threadId: string;
  marketplace: string;
  buyerName: string;
  text: string;
  listingTitle?: string;
  listingId: string;
  createdAt: string;
  isRead: boolean;
  firstRespondedAt?: string | null;
  assignee?: { id: number; fullName: string } | null;
  waitingMinutes?: number | null;
}

interface ReplyTemplate {
  id: number;
  name: string;
  content: string;
}

interface StaffUser {
  id: number;
  fullName: string;
}

const MP_NAMES: Record<string, string> = {
  olx: 'OLX',
  rozetka: 'Rozetka',
  prom: 'Prom.ua',
  epicentrk: 'Epicentr K',
};
const MP_ICONS: Record<string, string> = { olx: '🟢', rozetka: '🟩', prom: '🔵', epicentrk: '🟠' };

type FilterAssign = '' | 'unassigned' | string; // '' = all, 'unassigned', or numeric user id

export function MessagesTab() {
  const t = useTranslations('admin.messagesTab');
  const [messages, setMessages] = useState<MarketplaceMessage[]>([]);
  const [filterMp, setFilterMp] = useState('');
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterUnanswered, setFilterUnanswered] = useState(false);
  const [filterAssign, setFilterAssign] = useState<FilterAssign>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  // Load static reference data once.
  useEffect(() => {
    apiClient.get<ReplyTemplate[]>('/api/v1/admin/marketplaces/reply-templates').then((r) => {
      if (r.success && Array.isArray(r.data)) setTemplates(r.data);
    });
    apiClient
      .get<{ data: StaffUser[] } | StaffUser[]>('/api/v1/admin/users?roles=admin,manager&limit=100')
      .then((r) => {
        if (!r.success || !r.data) return;
        // The endpoint returns { data, total, ... } when paginated; fall back to array.
        const list = Array.isArray(r.data) ? r.data : (r.data as { data?: StaffUser[] }).data || [];
        setStaff(list);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const params = new URLSearchParams();
    if (filterMp) params.set('channel', filterMp);
    if (filterUnread) params.set('unread', '1');
    if (filterUnanswered) params.set('unanswered', '1');
    if (filterAssign) params.set('assignedTo', filterAssign);

    apiClient
      .get<MarketplaceMessage[]>(`/api/v1/admin/marketplaces/messages?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        if (res.success && Array.isArray(res.data)) setMessages(res.data);
        else if (!res.success) toast.error(t('loadFailed'));
      })
      .catch(() => {
        if (!cancelled) toast.error(t('networkError'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filterMp, filterUnread, filterUnanswered, filterAssign, reloadToken, t]);

  // Pin to Kyiv time — see HistoryTab.formatDate for the reasoning.
  const formatDate = (d: string) =>
    new Date(d).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Kyiv',
    });

  const waitingLabel = (mins: number | null | undefined) => {
    if (mins == null) return null;
    if (mins < 60) return t('waitMin', { n: mins });
    const h = Math.floor(mins / 60);
    if (h < 24) return t('waitHour', { n: h });
    return t('waitDay', { n: Math.floor(h / 24) });
  };

  const waitingColor = (mins: number | null | undefined) => {
    if (mins == null) return '';
    if (mins > 240) return 'text-red-600';
    if (mins > 60) return 'text-amber-600';
    return 'text-[var(--color-text-secondary)]';
  };

  const handleAssign = async (msg: MarketplaceMessage, assigneeId: number | null) => {
    const res = await apiClient.patch<{ assignee: { id: number; fullName: string } | null }>(
      `/api/v1/admin/marketplaces/messages/${msg.id}`,
      { assigneeId },
    );
    if (res.success && res.data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, assignee: res.data!.assignee } : m)),
      );
      toast.success(assigneeId ? t('assigned') : t('unassigned'));
    } else {
      toast.error(res.error || t('assignError'));
    }
  };

  const handleMarkRead = async (msg: MarketplaceMessage, isRead: boolean) => {
    const res = await apiClient.patch(`/api/v1/admin/marketplaces/messages/${msg.id}`, { isRead });
    if (res.success) {
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isRead } : m)));
    } else {
      toast.error(res.error || t('error'));
    }
  };

  // Client-side substring search across text/buyer/listing. Tight integration
  // with server filters means search runs on the already-filtered slice — fast
  // for the typical message volume (<1k).
  //
  // Strings get NFC-normalized before comparison so visually-identical
  // Ukrainian/Russian text composed differently (e.g. precomposed "й" vs
  // "и" + combining breve U+0306) still matches. Cheap to do on a small
  // dataset, but saves the "I see it but search doesn't find it" footgun.
  const normalize = (s: string | undefined | null) => (s ?? '').normalize('NFC').toLowerCase();
  const q = normalize(searchQuery.trim());
  const displayedMessages = q
    ? messages.filter(
        (m) =>
          normalize(m.text).includes(q) ||
          normalize(m.buyerName).includes(q) ||
          normalize(m.listingTitle).includes(q),
      )
    : messages;
  const unreadCount = displayedMessages.filter((m) => !m.isRead).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-64 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
        />
        <select
          value={filterMp}
          onChange={(e) => setFilterMp(e.target.value)}
          className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
        >
          <option value="">{t('allMarketplaces')}</option>
          {MARKETPLACES.map((m) => (
            <option key={m.key} value={m.key}>
              {m.icon} {m.name}
            </option>
          ))}
        </select>
        <select
          value={filterAssign}
          onChange={(e) => setFilterAssign(e.target.value as FilterAssign)}
          className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
        >
          <option value="">{t('anyManager')}</option>
          <option value="unassigned">{t('unassignedOption')}</option>
          {staff.map((u) => (
            <option key={u.id} value={String(u.id)}>
              👤 {u.fullName}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={filterUnread}
            onChange={(e) => setFilterUnread(e.target.checked)}
            className="accent-[var(--color-primary)]"
          />
          {t('onlyUnread')}
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={filterUnanswered}
            onChange={(e) => setFilterUnanswered(e.target.checked)}
            className="accent-[var(--color-primary)]"
          />
          {t('unanswered')}
        </label>
        <Button size="sm" variant="outline" onClick={refresh} title={t('refreshTitle')}>
          {t('refresh')}
        </Button>
        <p className="ml-auto text-xs text-[var(--color-text-secondary)]">
          {t.rich('countLine', {
            shown: displayedMessages.length,
            unread: unreadCount,
            b: (c) => <strong>{c}</strong>,
          })}
        </p>
      </div>

      {isLoading ? (
        <AdminTableSkeleton rows={5} columns={4} />
      ) : displayedMessages.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-12 text-center text-[var(--color-text-secondary)]">
          <p className="text-lg">{q ? t('notFound') : t('noMessages')}</p>
          <p className="mt-1 text-sm">{q ? t('searchHint') : t('emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayedMessages.map((msg) => {
            const replyKey = `${msg.marketplace}-${msg.id}`;
            return (
              <div
                key={replyKey}
                className={`rounded-[var(--radius)] border p-4 transition-colors ${
                  msg.isRead
                    ? 'border-[var(--color-border)] bg-[var(--color-bg)]'
                    : 'border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{MP_ICONS[msg.marketplace] || '📦'}</span>
                    <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                      {MP_NAMES[msg.marketplace] || msg.marketplace}
                    </span>
                    {!msg.isRead && (
                      <span className="rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[9px] font-bold text-white">
                        {t('newBadge')}
                      </span>
                    )}
                    {msg.waitingMinutes != null && (
                      <span
                        className={`text-[10px] ${waitingColor(msg.waitingMinutes)}`}
                        title={t('waitTitle')}
                      >
                        ⏱ {waitingLabel(msg.waitingMinutes)}
                      </span>
                    )}
                    {msg.firstRespondedAt && (
                      <span className="text-[10px] text-green-600" title={t('respondedTitle')}>
                        {t('respondedBadge')}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {formatDate(msg.createdAt)}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-sm font-bold text-[var(--color-text-secondary)]">
                    {msg.buyerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{msg.buyerName}</p>
                    <p className="mt-0.5 text-sm text-[var(--color-text)]">{msg.text}</p>
                    {msg.listingTitle && (
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        {t('product', { title: msg.listingTitle })}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <select
                        value={msg.assignee?.id ? String(msg.assignee.id) : ''}
                        onChange={(e) =>
                          handleAssign(msg, e.target.value ? Number(e.target.value) : null)
                        }
                        className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 text-[11px]"
                      >
                        <option value="">{t('noManagerOption')}</option>
                        {staff.map((u) => (
                          <option key={u.id} value={String(u.id)}>
                            👤 {u.fullName}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleMarkRead(msg, !msg.isRead)}
                        className="text-[11px] text-[var(--color-text-secondary)] hover:underline"
                      >
                        {msg.isRead ? t('markUnread') : t('markRead')}
                      </button>
                    </div>

                    <div className="mt-2">
                      {replyOpen === replyKey ? (
                        <div className="space-y-2">
                          {templates.length > 0 && (
                            <select
                              onChange={(e) => {
                                const tpl = templates.find((x) => String(x.id) === e.target.value);
                                if (tpl) setReplyText(tpl.content);
                                e.target.value = '';
                              }}
                              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs"
                              defaultValue=""
                            >
                              <option value="" disabled>
                                {t('insertTemplate')}
                              </option>
                              {templates.map((tpl) => (
                                <option key={tpl.id} value={String(tpl.id)}>
                                  {tpl.name}
                                </option>
                              ))}
                            </select>
                          )}
                          <div className="flex gap-2">
                            <textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder={t('replyPlaceholder')}
                              rows={3}
                              className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs"
                              autoFocus
                            />
                            <div className="flex flex-col gap-1">
                              <Button
                                size="sm"
                                isLoading={sending}
                                disabled={!replyText.trim() || sending}
                                onClick={async () => {
                                  setSending(true);
                                  const res = await apiClient.post(
                                    '/api/v1/admin/marketplaces/messages/reply',
                                    {
                                      channel: msg.marketplace,
                                      threadId: msg.threadId,
                                      text: replyText,
                                    },
                                  );
                                  if (res.success) {
                                    toast.success(t('replySent'));
                                    setReplyOpen(null);
                                    setReplyText('');
                                    setMessages((prev) =>
                                      prev.map((m) =>
                                        m.id === msg.id
                                          ? {
                                              ...m,
                                              isRead: true,
                                              firstRespondedAt: new Date().toISOString(),
                                            }
                                          : m,
                                      ),
                                    );
                                  } else {
                                    toast.error(res.error || t('sendFailed'));
                                  }
                                  setSending(false);
                                }}
                              >
                                {t('send')}
                              </Button>
                              <button
                                onClick={() => {
                                  setReplyOpen(null);
                                  setReplyText('');
                                }}
                                className="text-xs text-[var(--color-text-secondary)] hover:underline"
                              >
                                {t('cancel')}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setReplyOpen(replyKey);
                            setReplyText('');
                          }}
                          className="text-xs text-[var(--color-primary)] hover:underline"
                        >
                          {t('reply')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
