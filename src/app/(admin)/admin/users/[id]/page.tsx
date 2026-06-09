'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { apiClient, setAccessToken } from '@/lib/api-client';
import {
  USER_ROLE_LABELS,
  WHOLESALE_STATUS_LABELS,
  WHOLESALE_GROUP_LABELS,
  AUDIT_ACTION_LABELS,
  SEGMENT_LABELS,
} from '@/types/user';
import type {
  UserDetail,
  UserStats,
  UserAuditEntry,
  UserOrder,
  WishlistItem,
  RecentlyViewedItem,
  UserAddress,
  UserTimelineEntry,
} from '@/types/user';
import { ORDER_STATUS_COLORS } from '@/types/order';
import type { OrderStatus, PaymentStatus } from '@/types/order';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import UserSecurityTab from '@/components/admin/UserSecurityTab';
import { maskIp as maskIpDisplay } from '@/utils/pii';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import Modal from '@/components/ui/Modal';
import Image from 'next/image';

// Role + wholesale group are exposed as one dropdown so admins can promote a
// user straight into a specific pricing tier. Values are `role` or
// `wholesaler:<group>` for the three opt tiers.
const ROLE_OPTIONS = [
  { value: 'client', label: USER_ROLE_LABELS.client },
  { value: 'wholesaler:1', label: `${USER_ROLE_LABELS.wholesaler} — ${WHOLESALE_GROUP_LABELS[1]}` },
  { value: 'wholesaler:2', label: `${USER_ROLE_LABELS.wholesaler} — ${WHOLESALE_GROUP_LABELS[2]}` },
  { value: 'wholesaler:3', label: `${USER_ROLE_LABELS.wholesaler} — ${WHOLESALE_GROUP_LABELS[3]}` },
  { value: 'manager', label: USER_ROLE_LABELS.manager },
  { value: 'admin', label: USER_ROLE_LABELS.admin },
];

function roleSelectValue(role: string, group: number | null | undefined): string {
  if (role === 'wholesaler' && group) return `wholesaler:${group}`;
  return role;
}

type Tab =
  | 'info'
  | 'timeline'
  | 'orders'
  | 'audit'
  | 'wishlist'
  | 'recent'
  | 'addresses'
  | 'security';

export default function AdminUserDetailPage() {
  const t = useTranslations('admin.userDetailPage');
  const tl = useTranslations('orderLabels');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  const [actionResult, setActionResult] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('info');

  // Stats
  const [stats, setStats] = useState<UserStats | null>(null);

  // Each tab's loading flag is derived from `loadedTabs` so we never need a
  // synchronous setXxxLoading(true) inside the tab-load effects below.
  const [loadedTabs, setLoadedTabs] = useState<Set<Tab>>(new Set(['info']));
  const ordersLoading = activeTab === 'orders' && !loadedTabs.has('orders');
  const auditLoading = activeTab === 'audit' && !loadedTabs.has('audit');
  const wishlistLoading = activeTab === 'wishlist' && !loadedTabs.has('wishlist');
  const recentLoading = activeTab === 'recent' && !loadedTabs.has('recent');
  const addressesLoading = activeTab === 'addresses' && !loadedTabs.has('addresses');
  const timelineLoading = activeTab === 'timeline' && !loadedTabs.has('timeline');
  const markTabLoaded = (tab: Tab) =>
    setLoadedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });

  // Orders
  const [orders, setOrders] = useState<UserOrder[]>([]);

  // Audit
  const [auditLog, setAuditLog] = useState<UserAuditEntry[]>([]);

  // Wishlist
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);

  // Recently viewed
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);

  // Addresses
  const [addresses, setAddresses] = useState<UserAddress[]>([]);

  // Timeline
  const [timeline, setTimeline] = useState<UserTimelineEntry[]>([]);

  // Edit profile modal
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    companyName: '',
    edrpou: '',
    legalAddress: '',
  });

  // Block modal
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  // Reset password modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [tempPassword, setTempPassword] = useState('');

  // Admin note
  const [adminNote, setAdminNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Send message modal
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const [messageChannels, setMessageChannels] = useState<string[]>(['email']);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Delete account modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const showResult = (type: 'success' | 'error', text: string) => {
    setActionResult({ type, text });
    setTimeout(() => setActionResult(null), 4000);
  };

  useEffect(() => {
    apiClient
      .get<UserDetail>(`/api/v1/admin/users/${id}`)
      .then((res) => {
        if (res.success && res.data) {
          setUser(res.data);
          setSelectedRole(roleSelectValue(res.data.role, res.data.wholesaleGroup));
          setSelectedGroup(res.data.wholesaleGroup ? String(res.data.wholesaleGroup) : '');
          setAdminNote(res.data.adminNote || '');
        }
      })
      .finally(() => setIsLoading(false));

    // Load stats
    apiClient.get<UserStats>(`/api/v1/admin/users/${id}?section=stats`).then((res) => {
      if (res.success && res.data) setStats(res.data);
    });
  }, [id]);

  // Load orders tab
  useEffect(() => {
    if (activeTab !== 'orders' || loadedTabs.has('orders')) return;
    let cancelled = false;
    apiClient.get<UserOrder[]>(`/api/v1/admin/users/${id}?section=orders`).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setOrders(res.data);
      markTabLoaded('orders');
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, id, loadedTabs]);

  // Load audit tab
  useEffect(() => {
    if (activeTab !== 'audit' || loadedTabs.has('audit')) return;
    let cancelled = false;
    apiClient.get<UserAuditEntry[]>(`/api/v1/admin/users/${id}?section=audit`).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setAuditLog(res.data);
      markTabLoaded('audit');
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, id, loadedTabs]);

  // Load wishlist tab
  useEffect(() => {
    if (activeTab !== 'wishlist' || loadedTabs.has('wishlist')) return;
    let cancelled = false;
    apiClient.get<WishlistItem[]>(`/api/v1/admin/users/${id}?section=wishlist`).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setWishlist(res.data);
      markTabLoaded('wishlist');
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, id, loadedTabs]);

  // Load recently viewed tab
  useEffect(() => {
    if (activeTab !== 'recent' || loadedTabs.has('recent')) return;
    let cancelled = false;
    apiClient.get<RecentlyViewedItem[]>(`/api/v1/admin/users/${id}?section=recent`).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setRecentlyViewed(res.data);
      markTabLoaded('recent');
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, id, loadedTabs]);

  // Load timeline tab
  useEffect(() => {
    if (activeTab !== 'timeline' || loadedTabs.has('timeline')) return;
    let cancelled = false;
    apiClient.get<UserTimelineEntry[]>(`/api/v1/admin/users/${id}?section=timeline`).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setTimeline(res.data);
      markTabLoaded('timeline');
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, id, loadedTabs]);

  // Load addresses tab
  useEffect(() => {
    if (activeTab !== 'addresses' || loadedTabs.has('addresses')) return;
    let cancelled = false;
    apiClient.get<UserAddress[]>(`/api/v1/admin/users/${id}?section=addresses`).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setAddresses(res.data);
      markTabLoaded('addresses');
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, id, loadedTabs]);

  const reloadUser = async () => {
    const res = await apiClient.get<UserDetail>(`/api/v1/admin/users/${id}`);
    if (res.success && res.data) {
      setUser(res.data);
      setSelectedRole(roleSelectValue(res.data.role, res.data.wholesaleGroup));
      setSelectedGroup(res.data.wholesaleGroup ? String(res.data.wholesaleGroup) : '');
      setAdminNote(res.data.adminNote || '');
    }
  };

  // Role update — value may be `wholesaler:<group>` to set role + tier atomically.
  const handleRoleUpdate = async () => {
    if (!user || !selectedRole) return;
    const currentValue = roleSelectValue(user.role, user.wholesaleGroup);
    if (selectedRole === currentValue) return;

    let body: { role: string; wholesaleGroup?: number | null };
    if (selectedRole.startsWith('wholesaler:')) {
      const group = Number(selectedRole.split(':')[1]);
      body = { role: 'wholesaler', wholesaleGroup: group };
    } else {
      // Leaving wholesaler — clear the group so prices fall back to retail.
      body =
        user.role === 'wholesaler'
          ? { role: selectedRole, wholesaleGroup: null }
          : { role: selectedRole };
    }

    setIsUpdating(true);
    const res = await apiClient.put(`/api/v1/admin/users/${id}`, body);
    if (res.success) {
      await reloadUser();
      showResult('success', t('roleChanged'));
    } else {
      showResult('error', res.error || t('error'));
    }
    setIsUpdating(false);
  };

  // Wholesale group update
  const handleGroupUpdate = async () => {
    const newGroup = selectedGroup ? Number(selectedGroup) : null;
    const currentGroup = user?.wholesaleGroup ?? null;
    if (newGroup === currentGroup) return;
    setIsUpdatingGroup(true);
    const res = await apiClient.put(`/api/v1/admin/users/${id}`, { wholesaleGroup: newGroup });
    if (res.success) {
      await reloadUser();
      showResult(
        'success',
        newGroup
          ? t('groupChangedTo', { group: WHOLESALE_GROUP_LABELS[newGroup as 1 | 2 | 3] })
          : t('groupRemoved'),
      );
    } else {
      showResult('error', res.error || t('error'));
    }
    setIsUpdatingGroup(false);
  };

  // Edit profile
  const openEditModal = () => {
    if (!user) return;
    setEditForm({
      fullName: user.fullName,
      phone: user.phone || '',
      email: user.email,
      companyName: user.companyName || '',
      edrpou: user.edrpou || '',
      legalAddress: user.legalAddress || '',
    });
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    const res = await apiClient.put(`/api/v1/admin/users/${id}`, {
      action: 'editProfile',
      ...editForm,
    });
    if (res.success) {
      await reloadUser();
      setIsEditing(false);
      showResult('success', t('profileUpdated'));
    } else {
      showResult('error', res.error || t('saveError'));
    }
  };

  // Block/unblock
  const handleBlock = async () => {
    const res = await apiClient.put(`/api/v1/admin/users/${id}`, {
      action: 'block',
      reason: blockReason,
    });
    if (res.success) {
      await reloadUser();
      setShowBlockModal(false);
      setBlockReason('');
      showResult('success', t('userBlocked'));
    } else {
      showResult('error', res.error || t('error'));
    }
  };

  const handleUnblock = async () => {
    const res = await apiClient.put(`/api/v1/admin/users/${id}`, { action: 'unblock' });
    if (res.success) {
      await reloadUser();
      showResult('success', t('userUnblocked'));
    } else {
      showResult('error', res.error || t('error'));
    }
  };

  // Reset password
  const handleResetPassword = async () => {
    const res = await apiClient.put<{ tempPassword: string; email: string }>(
      `/api/v1/admin/users/${id}`,
      {
        action: 'resetPassword',
      },
    );
    if (res.success && res.data) {
      setTempPassword(res.data.tempPassword);
      showResult('success', t('passwordReset'));
    } else {
      showResult('error', res.error || t('error'));
    }
  };

  // Save admin note
  const handleSaveNote = async () => {
    setIsSavingNote(true);
    const res = await apiClient.put(`/api/v1/admin/users/${id}`, {
      action: 'saveNote',
      note: adminNote,
    });
    if (res.success) {
      showResult('success', t('noteSaved'));
    } else {
      showResult('error', res.error || t('error'));
    }
    setIsSavingNote(false);
  };

  // Verify email
  const handleVerifyEmail = async () => {
    const res = await apiClient.put(`/api/v1/admin/users/${id}`, { action: 'verifyEmail' });
    if (res.success) {
      await reloadUser();
      showResult('success', t('emailVerified'));
    } else {
      showResult('error', res.error || t('error'));
    }
  };

  // Send message
  const toggleChannel = (ch: string) => {
    setMessageChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || messageChannels.length === 0) {
      showResult('error', t('enterMessageChannel'));
      return;
    }
    setIsSendingMessage(true);
    const res = await apiClient.put(`/api/v1/admin/users/${id}`, {
      action: 'sendMessage',
      message: messageText,
      channels: messageChannels,
      subject: messageSubject || undefined,
    });
    if (res.success) {
      setShowMessageModal(false);
      setMessageText('');
      setMessageSubject('');
      setMessageChannels(['email']);
      showResult('success', t('messageSent'));
    } else {
      showResult('error', res.error || t('sendError'));
    }
    setIsSendingMessage(false);
  };

  // Export user data
  const handleExportData = async () => {
    const res = await apiClient.get(`/api/v1/admin/users/${id}?section=export`);
    if (res.success && res.data) {
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user-${id}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
      showResult('success', t('dataExported'));
    } else {
      showResult('error', t('exportError'));
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    if (deleteConfirm !== t('deleteKeyword')) return;
    setIsDeleting(true);
    const res = await apiClient.put(`/api/v1/admin/users/${id}`, { action: 'deleteAccount' });
    if (res.success) {
      showResult('success', t('accountDeleted'));
      router.push('/admin/users');
    } else {
      showResult('error', res.error || t('deleteError'));
    }
    setIsDeleting(false);
  };

  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString('uk-UA', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '—';

  const formatDateTime = (d: string | Date) =>
    new Date(d).toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center">
        <p className="text-[var(--color-text-secondary)]">{t('notFound')}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/users')}>
          {t('toList')}
        </Button>
      </div>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'info', label: t('tabInfo') },
    { key: 'timeline', label: t('tabTimeline') },
    { key: 'orders', label: t('tabOrders') },
    { key: 'wishlist', label: t('tabWishlist') },
    { key: 'recent', label: t('tabRecent') },
    { key: 'addresses', label: t('tabAddresses') },
    { key: 'security', label: t('tabSecurity') },
    { key: 'audit', label: t('tabAudit') },
  ];

  return (
    <div>
      {/* Header */}
      <Link href="/admin/users" className="text-sm text-[var(--color-primary)] hover:underline">
        &larr; {t('breadcrumb')}
      </Link>

      <div className="mt-4 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{user.fullName}</h2>
            {user.isBlocked && (
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                {t('blocked')}
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">{user.email}</p>
          {user.phone && <p className="text-sm text-[var(--color-text-secondary)]">{user.phone}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            options={ROLE_OPTIONS}
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-40"
          />
          <Button
            size="sm"
            onClick={handleRoleUpdate}
            isLoading={isUpdating}
            disabled={selectedRole === roleSelectValue(user.role, user.wholesaleGroup)}
          >
            {t('save')}
          </Button>
          <Button size="sm" variant="outline" onClick={openEditModal}>
            {t('edit')}
          </Button>
          {user.isBlocked ? (
            <Button size="sm" variant="outline" onClick={handleUnblock}>
              {t('unblock')}
            </Button>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setShowBlockModal(true)}>
              {t('block')}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowResetModal(true)}>
            {t('resetPassword')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowMessageModal(true)}>
            {t('message')}
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportData}>
            {t('export')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              // Impersonation is privileged: it logs the admin in as the
              // target user, with full session privileges. Accidental
              // clicks have happened — confirm explicitly with the user's
              // identity so the admin sees WHO they're about to become.
              const targetLabel =
                (user as { fullName?: string; email?: string } | null)?.fullName ||
                (user as { email?: string } | null)?.email ||
                `#${id}`;
              const ok = window.confirm(t('impersonateConfirm', { name: targetLabel }));
              if (!ok) return;
              const res = await apiClient.post<{ accessToken: string }>(
                `/api/v1/admin/users/${id}/impersonate`,
                {},
              );
              if (res.success && res.data?.accessToken) {
                setAccessToken(res.data.accessToken);
                router.push('/');
              } else {
                showResult('error', res.error || t('impersonateFailed'));
              }
            }}
          >
            {t('impersonate')}
          </Button>
        </div>
      </div>

      {actionResult && (
        <div
          className={`mb-4 rounded-[var(--radius)] p-3 text-sm ${actionResult.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-[var(--color-danger)]'}`}
        >
          {actionResult.text}
        </div>
      )}

      {/* Stats cards */}
      {stats && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              label={t('statTotalOrders')}
              value={stats.totalOrders}
              color="text-blue-600"
              bg="bg-blue-50"
            />
            <StatCard
              label={t('statCompleted')}
              value={stats.completedOrders}
              color="text-emerald-600"
              bg="bg-emerald-50"
            />
            <StatCard
              label={t('statPurchases')}
              value={`${stats.totalPurchases.toFixed(0)} \u20B4`}
              color="text-violet-600"
              bg="bg-violet-50"
            />
            <StatCard
              label={t('statAvgCheck')}
              value={`${stats.avgCheck.toFixed(0)} \u20B4`}
              color="text-amber-600"
              bg="bg-amber-50"
            />
            <StatCard
              label={t('statLtv')}
              value={
                stats.predictedLtv12mo !== undefined
                  ? `${stats.predictedLtv12mo.toFixed(0)} ₴`
                  : '—'
              }
              color="text-pink-600"
              bg="bg-pink-50"
            />
            <StatCard
              label={t('statLastOrder')}
              value={
                stats.lastOrderDate
                  ? stats.daysSinceLastOrder !== null && stats.daysSinceLastOrder !== undefined
                    ? t('daysAgo', { days: stats.daysSinceLastOrder })
                    : formatDate(stats.lastOrderDate)
                  : t('none')
              }
              color="text-gray-600"
              bg="bg-gray-50"
            />
          </div>
          {stats.segments && stats.segments.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
                {t('segment')}
              </span>
              {stats.segments.map((seg) => {
                const meta = SEGMENT_LABELS[seg] ?? {
                  label: seg,
                  color: 'bg-gray-100 text-gray-700 border-gray-200',
                };
                return (
                  <span
                    key={seg}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.color}`}
                  >
                    {meta.label}
                  </span>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-[var(--color-border)]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Info */}
      {activeTab === 'info' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoCard title={t('cardMain')}>
              <Row label={t('rowRole')} value={USER_ROLE_LABELS[user.role]} />
              <Row label={t('rowPhone')} value={user.phone || '—'} />
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">{t('verified')}</span>
                <span className="flex items-center gap-2 font-medium">
                  {user.isVerified ? (
                    t('yes')
                  ) : (
                    <>
                      <span className="text-amber-600">{t('no')}</span>
                      <button
                        onClick={handleVerifyEmail}
                        className="rounded bg-[var(--color-primary)] px-2 py-0.5 text-xs text-white hover:opacity-90"
                      >
                        {t('verify')}
                      </button>
                    </>
                  )}
                </span>
              </div>
              <Row label={t('rowOrders')} value={String(user._count.orders)} />
              <Row label={t('rowRegistered')} value={formatDate(user.createdAt as string)} />
              {user.isBlocked && user.blockedAt && (
                <>
                  <Row label={t('rowBlocked')} value={formatDate(user.blockedAt)} />
                  {user.blockedReason && <Row label={t('rowReason')} value={user.blockedReason} />}
                </>
              )}
            </InfoCard>

            <InfoCard title={t('cardWholesale')}>
              <Row label={t('rowStatus')} value={WHOLESALE_STATUS_LABELS[user.wholesaleStatus]} />
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">{t('wholesaleGroup')}</span>
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs"
                  >
                    <option value="">{t('noGroup')}</option>
                    {Object.entries(WHOLESALE_GROUP_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleGroupUpdate}
                    disabled={
                      isUpdatingGroup ||
                      (selectedGroup ? Number(selectedGroup) : null) ===
                        (user.wholesaleGroup ?? null)
                    }
                    className="rounded bg-[var(--color-primary)] px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-40"
                  >
                    {isUpdatingGroup ? '...' : t('save')}
                  </button>
                </div>
              </div>
              <Row
                label={t('rowRequestDate')}
                value={formatDate(user.wholesaleRequestDate as string)}
              />
              <Row label={t('rowApprovedDate')} value={formatDate(user.wholesaleApprovedDate)} />
              <Row label={t('rowExpectedVol')} value={user.wholesaleMonthlyVol || '—'} />
              {user.assignedManager && (
                <Row label={t('rowManager')} value={user.assignedManager.fullName} />
              )}
            </InfoCard>

            {(user.companyName || user.edrpou) && (
              <InfoCard title={t('cardCompany')}>
                <Row label={t('rowCompany')} value={user.companyName || '—'} />
                <Row label={t('rowEdrpou')} value={user.edrpou || '—'} />
                <Row label={t('rowAddress')} value={user.legalAddress || '—'} />
                <Row label={t('rowIban')} value={user.bankIban || '—'} />
                <Row label={t('rowBank')} value={user.bankName || '—'} />
                <Row label={t('rowOwnership')} value={user.ownershipType || '—'} />
                <Row
                  label={t('rowTaxes')}
                  value={
                    user.taxSystem === 'with_vat'
                      ? t('taxWithVat')
                      : user.taxSystem === 'without_vat'
                        ? t('taxWithoutVat')
                        : '—'
                  }
                />
              </InfoCard>
            )}
          </div>

          {/* Admin note */}
          <div className="mt-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
              {t('managerNote')}
            </p>
            <div className="flex gap-2">
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder={t('notePlaceholder')}
                rows={2}
                className="flex-1 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              />
              <Button size="sm" variant="outline" onClick={handleSaveNote} isLoading={isSavingNote}>
                {t('save')}
              </Button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="mt-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase text-red-600">{t('dangerZone')}</p>
            <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
              {t('deleteAccountWarn')}
            </p>
            <Button size="sm" variant="danger" onClick={() => setShowDeleteModal(true)}>
              {t('deleteAccount')}
            </Button>
          </div>
        </>
      )}

      {/* Tab: Orders */}
      {activeTab === 'orders' && (
        <div>
          {ordersLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
              {t('noOrders')}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    <th className="px-4 py-3 text-left font-medium">{t('thOrder')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('thStatus')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('thPayment')}</th>
                    <th className="px-4 py-3 text-center font-medium">{t('thItems')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('thAmount')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('thDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr
                      key={o.id}
                      className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="font-medium text-[var(--color-primary)] hover:underline"
                        >
                          #{o.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: ORDER_STATUS_COLORS[o.status as OrderStatus] }}
                        >
                          {tl(`status.${o.status as OrderStatus}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            o.paymentStatus === 'paid'
                              ? 'bg-green-100 text-green-700'
                              : o.paymentStatus === 'pending'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {tl(`paymentStatus.${o.paymentStatus as PaymentStatus}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">{o.itemsCount}</td>
                      <td className="px-4 py-3 text-right font-bold">
                        {Number(o.totalAmount).toFixed(2)} &#8372;
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {formatDateTime(o.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Wishlist */}
      {activeTab === 'wishlist' && (
        <div>
          {wishlistLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : wishlist.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
              {t('wishlistEmpty')}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {wishlist.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
                >
                  {item.product.imageUrl ? (
                    <Image
                      src={item.product.imageUrl}
                      alt=""
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-secondary)]">
                      {t('photo')}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/products/${item.product.id}`}
                      className="text-sm font-medium text-[var(--color-primary)] hover:underline line-clamp-2"
                    >
                      {item.product.name}
                    </Link>
                    <p className="mt-1 text-sm font-bold">
                      {item.product.price.toFixed(2)} &#8372;
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`text-xs ${item.product.inStock ? 'text-green-600' : 'text-red-500'}`}
                      >
                        {item.product.inStock ? t('inStock') : t('outStock')}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-secondary)]">
                        {t('added', { date: formatDate(item.createdAt) })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Recently viewed */}
      {activeTab === 'recent' && (
        <div>
          {recentLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : recentlyViewed.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
              {t('noRecent')}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentlyViewed.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
                >
                  {item.product.imageUrl ? (
                    <Image
                      src={item.product.imageUrl}
                      alt=""
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-secondary)]">
                      {t('photo')}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/products/${item.product.id}`}
                      className="text-sm font-medium text-[var(--color-primary)] hover:underline line-clamp-2"
                    >
                      {item.product.name}
                    </Link>
                    <p className="mt-1 text-sm font-bold">
                      {item.product.price.toFixed(2)} &#8372;
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
                      {t('viewed', { date: formatDateTime(item.viewedAt) })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Addresses */}
      {activeTab === 'addresses' && (
        <div>
          {addressesLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : addresses.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
              {t('noAddresses')}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"
                >
                  <div className="flex items-center gap-2">
                    {addr.label && <span className="text-sm font-medium">{addr.label}</span>}
                    {addr.isDefault && (
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        {t('defaultAddr')}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm">{addr.city}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {[
                      addr.street,
                      addr.building && t('building', { n: addr.building }),
                      addr.apartment && t('apartment', { n: addr.apartment }),
                    ]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </p>
                  {addr.postalCode && (
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {t('postalIndex', { code: addr.postalCode })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Timeline */}
      {activeTab === 'timeline' && (
        <div>
          {timelineLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : timeline.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
              {t('noTimeline')}
            </p>
          ) : (
            <ol className="relative space-y-3 border-l border-[var(--color-border)] pl-6">
              {timeline.map((entry) => {
                const kindStyle: Record<typeof entry.kind, string> = {
                  order: 'bg-blue-500',
                  review: 'bg-amber-500',
                  audit: 'bg-gray-500',
                  event: 'bg-emerald-500',
                };
                const kindLabel: Record<typeof entry.kind, string> = {
                  order: t('kindOrder'),
                  review: t('kindReview'),
                  audit: t('kindAudit'),
                  event: t('kindEvent'),
                };
                return (
                  <li key={entry.id} className="relative">
                    <span
                      className={`absolute -left-[1.6rem] mt-1.5 h-3 w-3 rounded-full ring-4 ring-[var(--color-bg)] ${kindStyle[entry.kind]}`}
                    />
                    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
                            {kindLabel[entry.kind]}
                          </span>
                          {entry.href ? (
                            <Link
                              href={entry.href}
                              className="text-sm font-medium text-[var(--color-primary)] hover:underline"
                            >
                              {entry.title}
                            </Link>
                          ) : (
                            <span className="text-sm font-medium">{entry.title}</span>
                          )}
                        </div>
                        <span className="shrink-0 text-xs text-[var(--color-text-secondary)]">
                          {formatDateTime(entry.at)}
                        </span>
                      </div>
                      {entry.body && (
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          {entry.body}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {/* Tab: Audit log */}
      {activeTab === 'security' && user && <UserSecurityTab userId={user.id} />}

      {activeTab === 'audit' && (
        <div>
          {auditLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : auditLog.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
              {t('noAuditRecords')}
            </p>
          ) : (
            <div className="space-y-2">
              {auditLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3"
                >
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">
                        {AUDIT_ACTION_LABELS[entry.actionType] || entry.actionType}
                      </span>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {formatDateTime(entry.createdAt)}
                      </span>
                    </div>
                    {entry.user && (
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {t('performedBy', { name: entry.user.fullName })}
                      </p>
                    )}
                    {entry.details && typeof entry.details === 'object' && (
                      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                        {Object.entries(entry.details as Record<string, unknown>)
                          .filter(([, v]) => v !== undefined && v !== null && v !== '')
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(', ')}
                      </p>
                    )}
                    {entry.ipAddress && (
                      <p
                        className="font-mono text-[10px] text-[var(--color-text-secondary)]"
                        title={t('ipMaskedTitle')}
                      >
                        {t('ipLabel', { ip: maskIpDisplay(entry.ipAddress) ?? '—' })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit profile modal */}
      <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title={t('editProfile')}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
              {t('fldName')}
            </label>
            <Input
              value={editForm.fullName}
              onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
              {t('fldEmail')}
            </label>
            <Input
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
              {t('fldPhone')}
            </label>
            <Input
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
              {t('fldCompany')}
            </label>
            <Input
              value={editForm.companyName}
              onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
              {t('fldEdrpou')}
            </label>
            <Input
              value={editForm.edrpou}
              onChange={(e) => setEditForm({ ...editForm, edrpou: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
              {t('fldLegalAddress')}
            </label>
            <Input
              value={editForm.legalAddress}
              onChange={(e) => setEditForm({ ...editForm, legalAddress: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSaveProfile}>{t('save')}</Button>
          </div>
        </div>
      </Modal>

      {/* Block modal */}
      <Modal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        title={t('blockTitle')}
      >
        <div className="space-y-3">
          <p className="text-sm">
            {t('blockMsgPre')}
            <b>{user.fullName}</b>
            {t('blockMsgPost')}
          </p>
          <Input
            placeholder={t('blockReasonPh')}
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowBlockModal(false)}>
              {t('cancel')}
            </Button>
            <Button variant="danger" onClick={handleBlock}>
              {t('block')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reset password modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => {
          setShowResetModal(false);
          setTempPassword('');
        }}
        title={t('resetTitle')}
      >
        <div className="space-y-3">
          {!tempPassword ? (
            <>
              <p className="text-sm">
                {t('resetMsgPre')}
                <b>{user.fullName}</b>
                {t('resetMsgPost', { email: user.email })}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowResetModal(false)}>
                  {t('cancel')}
                </Button>
                <Button onClick={handleResetPassword}>{t('reset')}</Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm">{t('newTempPassword')}</p>
              <div className="flex items-center gap-2 rounded-[var(--radius)] bg-[var(--color-bg-secondary)] p-3">
                <code className="flex-1 text-lg font-bold tracking-wider">{tempPassword}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(tempPassword);
                    showResult('success', t('copied'));
                  }}
                >
                  {t('copy')}
                </Button>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)]">{t('passToClient')}</p>
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setShowResetModal(false);
                    setTempPassword('');
                  }}
                >
                  {t('close')}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Send message modal */}
      <Modal
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        title={t('sendMessageTitle')}
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t('sendMessageToPre')}
            <b>{user.fullName}</b>
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
              {t('channels')}
            </label>
            <div className="flex gap-3">
              {[
                { key: 'email', label: 'Email' },
                { key: 'telegram', label: 'Telegram' },
              ].map((ch) => (
                <label key={ch.key} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={messageChannels.includes(ch.key)}
                    onChange={() => toggleChannel(ch.key)}
                    className="rounded"
                  />
                  {ch.label}
                </label>
              ))}
            </div>
          </div>
          {messageChannels.includes('email') && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
                {t('subjectEmail')}
              </label>
              <Input
                value={messageSubject}
                onChange={(e) => setMessageSubject(e.target.value)}
                placeholder={t('subjectPh')}
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
              {t('messageLabel')}
            </label>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={t('messagePh')}
              rows={4}
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowMessageModal(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleSendMessage}
              isLoading={isSendingMessage}
              disabled={!messageText.trim() || messageChannels.length === 0}
            >
              {t('send')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete account modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteConfirm('');
        }}
        title={t('deleteTitle')}
      >
        <div className="space-y-3">
          <div className="rounded bg-red-50 p-3 text-sm text-red-700">
            <b>{t('warnLabel')}</b>
            {t('deleteWarnText')}
          </div>
          <p className="text-sm">
            {t('deleteConfirmPre')}
            <b>{user.fullName}</b>
            {t('deleteConfirmMid', { email: user.email })}
            <code className="rounded bg-[var(--color-bg-secondary)] px-1.5 py-0.5 font-bold">
              {t('deleteKeyword')}
            </code>
            :
          </p>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={t('deleteKeywordPh', { keyword: t('deleteKeyword') })}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteConfirm('');
              }}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAccount}
              isLoading={isDeleting}
              disabled={deleteConfirm !== t('deleteKeyword')}
            >
              {t('deleteForever')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[var(--color-text-secondary)]">{label}</span>
      <span className="font-medium text-right max-w-[60%] break-words">{value}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: string | number;
  color: string;
  bg: string;
}) {
  return (
    <div className={`rounded-xl ${bg} px-4 py-3`}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{label}</p>
    </div>
  );
}
