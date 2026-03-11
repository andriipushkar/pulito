'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import {
  USER_ROLE_LABELS,
  WHOLESALE_STATUS_LABELS,
  WHOLESALE_GROUP_LABELS,
  AUDIT_ACTION_LABELS,
} from '@/types/user';
import type {
  UserDetail,
  UserRole,
  UserStats,
  UserAuditEntry,
  UserOrder,
  WishlistItem,
  RecentlyViewedItem,
  UserAddress,
} from '@/types/user';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, PAYMENT_STATUS_LABELS } from '@/types/order';
import type { OrderStatus, PaymentStatus } from '@/types/order';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import Modal from '@/components/ui/Modal';

const ROLE_OPTIONS = Object.entries(USER_ROLE_LABELS).map(([v, l]) => ({ value: v, label: l }));

type Tab = 'info' | 'orders' | 'audit' | 'wishlist' | 'recent' | 'addresses';

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  const [actionResult, setActionResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('info');

  // Stats
  const [stats, setStats] = useState<UserStats | null>(null);

  // Orders
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Audit
  const [auditLog, setAuditLog] = useState<UserAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Wishlist
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  // Recently viewed
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  // Addresses
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);

  // Edit profile modal
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ fullName: '', phone: '', email: '', companyName: '', edrpou: '', legalAddress: '' });

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
          setSelectedRole(res.data.role);
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
    if (activeTab === 'orders' && orders.length === 0) {
      setOrdersLoading(true);
      apiClient.get<UserOrder[]>(`/api/v1/admin/users/${id}?section=orders`).then((res) => {
        if (res.success && res.data) setOrders(res.data);
      }).finally(() => setOrdersLoading(false));
    }
  }, [activeTab, id, orders.length]);

  // Load audit tab
  useEffect(() => {
    if (activeTab === 'audit' && auditLog.length === 0) {
      setAuditLoading(true);
      apiClient.get<UserAuditEntry[]>(`/api/v1/admin/users/${id}?section=audit`).then((res) => {
        if (res.success && res.data) setAuditLog(res.data);
      }).finally(() => setAuditLoading(false));
    }
  }, [activeTab, id, auditLog.length]);

  // Load wishlist tab
  useEffect(() => {
    if (activeTab === 'wishlist' && wishlist.length === 0) {
      setWishlistLoading(true);
      apiClient.get<WishlistItem[]>(`/api/v1/admin/users/${id}?section=wishlist`).then((res) => {
        if (res.success && res.data) setWishlist(res.data);
      }).finally(() => setWishlistLoading(false));
    }
  }, [activeTab, id, wishlist.length]);

  // Load recently viewed tab
  useEffect(() => {
    if (activeTab === 'recent' && recentlyViewed.length === 0) {
      setRecentLoading(true);
      apiClient.get<RecentlyViewedItem[]>(`/api/v1/admin/users/${id}?section=recent`).then((res) => {
        if (res.success && res.data) setRecentlyViewed(res.data);
      }).finally(() => setRecentLoading(false));
    }
  }, [activeTab, id, recentlyViewed.length]);

  // Load addresses tab
  useEffect(() => {
    if (activeTab === 'addresses' && addresses.length === 0) {
      setAddressesLoading(true);
      apiClient.get<UserAddress[]>(`/api/v1/admin/users/${id}?section=addresses`).then((res) => {
        if (res.success && res.data) setAddresses(res.data);
      }).finally(() => setAddressesLoading(false));
    }
  }, [activeTab, id, addresses.length]);

  const reloadUser = async () => {
    const res = await apiClient.get<UserDetail>(`/api/v1/admin/users/${id}`);
    if (res.success && res.data) {
      setUser(res.data);
      setSelectedRole(res.data.role);
      setAdminNote(res.data.adminNote || '');
    }
  };

  // Role update
  const handleRoleUpdate = async () => {
    if (!selectedRole || selectedRole === user?.role) return;
    setIsUpdating(true);
    const res = await apiClient.put(`/api/v1/admin/users/${id}`, { role: selectedRole });
    if (res.success) {
      await reloadUser();
      showResult('success', 'Роль змінено');
    } else {
      showResult('error', res.error || 'Помилка');
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
      showResult('success', newGroup ? `Групу змінено на "${WHOLESALE_GROUP_LABELS[newGroup as 1 | 2 | 3]}"` : 'Групу знято');
    } else {
      showResult('error', res.error || 'Помилка');
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
      showResult('success', 'Профіль оновлено');
    } else {
      showResult('error', res.error || 'Помилка збереження');
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
      showResult('success', 'Користувача заблоковано');
    } else {
      showResult('error', res.error || 'Помилка');
    }
  };

  const handleUnblock = async () => {
    const res = await apiClient.put(`/api/v1/admin/users/${id}`, { action: 'unblock' });
    if (res.success) {
      await reloadUser();
      showResult('success', 'Користувача розблоковано');
    } else {
      showResult('error', res.error || 'Помилка');
    }
  };

  // Reset password
  const handleResetPassword = async () => {
    const res = await apiClient.put<{ tempPassword: string; email: string }>(`/api/v1/admin/users/${id}`, {
      action: 'resetPassword',
    });
    if (res.success && res.data) {
      setTempPassword(res.data.tempPassword);
      showResult('success', 'Пароль скинуто');
    } else {
      showResult('error', res.error || 'Помилка');
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
      showResult('success', 'Нотатку збережено');
    } else {
      showResult('error', res.error || 'Помилка');
    }
    setIsSavingNote(false);
  };

  // Verify email
  const handleVerifyEmail = async () => {
    const res = await apiClient.put(`/api/v1/admin/users/${id}`, { action: 'verifyEmail' });
    if (res.success) {
      await reloadUser();
      showResult('success', 'Email верифіковано');
    } else {
      showResult('error', res.error || 'Помилка');
    }
  };

  // Send message
  const toggleChannel = (ch: string) => {
    setMessageChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || messageChannels.length === 0) {
      showResult('error', 'Вкажіть повідомлення та хоча б один канал');
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
      showResult('success', 'Повідомлення надіслано');
    } else {
      showResult('error', res.error || 'Помилка надсилання');
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
      showResult('success', 'Дані експортовано');
    } else {
      showResult('error', 'Помилка експорту');
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'ВИДАЛИТИ') return;
    setIsDeleting(true);
    const res = await apiClient.put(`/api/v1/admin/users/${id}`, { action: 'deleteAccount' });
    if (res.success) {
      showResult('success', 'Акаунт видалено');
      router.push('/admin/users');
    } else {
      showResult('error', res.error || 'Помилка видалення');
    }
    setIsDeleting(false);
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  const formatDateTime = (d: string | Date) =>
    new Date(d).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  if (!user) {
    return (
      <div className="text-center">
        <p className="text-[var(--color-text-secondary)]">Користувача не знайдено</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/users')}>До списку</Button>
      </div>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'info', label: 'Інформація' },
    { key: 'orders', label: 'Замовлення' },
    { key: 'wishlist', label: 'Список бажань' },
    { key: 'recent', label: 'Перегляди' },
    { key: 'addresses', label: 'Адреси' },
    { key: 'audit', label: 'Лог дій' },
  ];

  return (
    <div>
      {/* Header */}
      <Link href="/admin/users" className="text-sm text-[var(--color-primary)] hover:underline">
        &larr; Користувачі
      </Link>

      <div className="mt-4 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{user.fullName}</h2>
            {user.isBlocked && (
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                Заблоковано
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">{user.email}</p>
          {user.phone && <p className="text-sm text-[var(--color-text-secondary)]">{user.phone}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select options={ROLE_OPTIONS} value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="w-40" />
          <Button size="sm" onClick={handleRoleUpdate} isLoading={isUpdating} disabled={selectedRole === user.role}>Зберегти</Button>
          <Button size="sm" variant="outline" onClick={openEditModal}>Редагувати</Button>
          {user.isBlocked ? (
            <Button size="sm" variant="outline" onClick={handleUnblock}>Розблокувати</Button>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setShowBlockModal(true)}>Заблокувати</Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowResetModal(true)}>Скинути пароль</Button>
          <Button size="sm" variant="outline" onClick={() => setShowMessageModal(true)}>Повідомлення</Button>
          <Button size="sm" variant="outline" onClick={handleExportData}>Експорт</Button>
        </div>
      </div>

      {actionResult && (
        <div className={`mb-4 rounded-[var(--radius)] p-3 text-sm ${actionResult.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-[var(--color-danger)]'}`}>
          {actionResult.text}
        </div>
      )}

      {/* Stats cards */}
      {stats && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Всього замовлень" value={stats.totalOrders} color="text-blue-600" bg="bg-blue-50" />
          <StatCard label="Виконаних" value={stats.completedOrders} color="text-emerald-600" bg="bg-emerald-50" />
          <StatCard label="Сума покупок" value={`${stats.totalPurchases.toFixed(0)} \u20B4`} color="text-violet-600" bg="bg-violet-50" />
          <StatCard label="Середній чек" value={`${stats.avgCheck.toFixed(0)} \u20B4`} color="text-amber-600" bg="bg-amber-50" />
          <StatCard label="Останнє замовлення" value={stats.lastOrderDate ? formatDate(stats.lastOrderDate) : 'Немає'} color="text-gray-600" bg="bg-gray-50" />
        </div>
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
            <InfoCard title="Основні дані">
              <Row label="Роль" value={USER_ROLE_LABELS[user.role]} />
              <Row label="Телефон" value={user.phone || '—'} />
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Верифікований</span>
                <span className="flex items-center gap-2 font-medium">
                  {user.isVerified ? 'Так' : (
                    <>
                      <span className="text-amber-600">Ні</span>
                      <button
                        onClick={handleVerifyEmail}
                        className="rounded bg-[var(--color-primary)] px-2 py-0.5 text-xs text-white hover:opacity-90"
                      >
                        Верифікувати
                      </button>
                    </>
                  )}
                </span>
              </div>
              <Row label="Замовлень" value={String(user._count.orders)} />
              <Row label="Зареєстрований" value={formatDate(user.createdAt as string)} />
              {user.isBlocked && user.blockedAt && (
                <>
                  <Row label="Заблоковано" value={formatDate(user.blockedAt)} />
                  {user.blockedReason && <Row label="Причина" value={user.blockedReason} />}
                </>
              )}
            </InfoCard>

            <InfoCard title="Оптовий статус">
              <Row label="Статус" value={WHOLESALE_STATUS_LABELS[user.wholesaleStatus]} />
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Оптова група</span>
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs"
                  >
                    <option value="">Без групи</option>
                    {Object.entries(WHOLESALE_GROUP_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleGroupUpdate}
                    disabled={isUpdatingGroup || (selectedGroup ? Number(selectedGroup) : null) === (user.wholesaleGroup ?? null)}
                    className="rounded bg-[var(--color-primary)] px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-40"
                  >
                    {isUpdatingGroup ? '...' : 'Зберегти'}
                  </button>
                </div>
              </div>
              <Row label="Дата запиту" value={formatDate(user.wholesaleRequestDate as string)} />
              <Row label="Дата підтвердження" value={formatDate(user.wholesaleApprovedDate)} />
              <Row label="Очікуваний обсяг" value={user.wholesaleMonthlyVol || '—'} />
              {user.assignedManager && <Row label="Менеджер" value={user.assignedManager.fullName} />}
            </InfoCard>

            {(user.companyName || user.edrpou) && (
              <InfoCard title="Дані компанії">
                <Row label="Компанія" value={user.companyName || '—'} />
                <Row label="ЄДРПОУ" value={user.edrpou || '—'} />
                <Row label="Адреса" value={user.legalAddress || '—'} />
                <Row label="IBAN" value={user.bankIban || '—'} />
                <Row label="Банк" value={user.bankName || '—'} />
                <Row label="Форма" value={user.ownershipType || '—'} />
                <Row label="Податки" value={user.taxSystem === 'with_vat' ? 'З ПДВ' : user.taxSystem === 'without_vat' ? 'Без ПДВ' : '—'} />
              </InfoCard>
            )}
          </div>

          {/* Admin note */}
          <div className="mt-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
              Нотатка менеджера
            </p>
            <div className="flex gap-2">
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Внутрішній коментар (видно тільки менеджерам)..."
                rows={2}
                className="flex-1 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              />
              <Button size="sm" variant="outline" onClick={handleSaveNote} isLoading={isSavingNote}>
                Зберегти
              </Button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="mt-4 rounded-[var(--radius)] border border-red-200 bg-red-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase text-red-600">Небезпечна зона</p>
            <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
              Видалення акаунту анонімізує всі дані користувача та є незворотною дією.
            </p>
            <Button size="sm" variant="danger" onClick={() => setShowDeleteModal(true)}>
              Видалити акаунт
            </Button>
          </div>
        </>
      )}

      {/* Tab: Orders */}
      {activeTab === 'orders' && (
        <div>
          {ordersLoading ? (
            <div className="flex justify-center py-8"><Spinner size="md" /></div>
          ) : orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">Замовлень немає</p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    <th className="px-4 py-3 text-left font-medium">Замовлення</th>
                    <th className="px-4 py-3 text-left font-medium">Статус</th>
                    <th className="px-4 py-3 text-left font-medium">Оплата</th>
                    <th className="px-4 py-3 text-center font-medium">Товарів</th>
                    <th className="px-4 py-3 text-right font-medium">Сума</th>
                    <th className="px-4 py-3 text-left font-medium">Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)]">
                      <td className="px-4 py-3">
                        <Link href={`/admin/orders/${o.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                          #{o.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: ORDER_STATUS_COLORS[o.status as OrderStatus] }}
                        >
                          {ORDER_STATUS_LABELS[o.status as OrderStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          o.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
                          o.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {PAYMENT_STATUS_LABELS[o.paymentStatus as PaymentStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">{o.itemsCount}</td>
                      <td className="px-4 py-3 text-right font-bold">{Number(o.totalAmount).toFixed(2)} &#8372;</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{formatDateTime(o.createdAt)}</td>
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
            <div className="flex justify-center py-8"><Spinner size="md" /></div>
          ) : wishlist.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">Список бажань порожній</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {wishlist.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                  {item.product.imageUrl ? (
                    <img src={item.product.imageUrl} alt="" className="h-16 w-16 rounded object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-secondary)]">Фото</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/products/${item.product.id}`} className="text-sm font-medium text-[var(--color-primary)] hover:underline line-clamp-2">
                      {item.product.name}
                    </Link>
                    <p className="mt-1 text-sm font-bold">{item.product.price.toFixed(2)} &#8372;</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`text-xs ${item.product.inStock ? 'text-green-600' : 'text-red-500'}`}>
                        {item.product.inStock ? 'В наявності' : 'Немає'}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-secondary)]">
                        Додано: {formatDate(item.createdAt)}
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
            <div className="flex justify-center py-8"><Spinner size="md" /></div>
          ) : recentlyViewed.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">Немає переглянутих товарів</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentlyViewed.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                  {item.product.imageUrl ? (
                    <img src={item.product.imageUrl} alt="" className="h-16 w-16 rounded object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-secondary)]">Фото</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/products/${item.product.id}`} className="text-sm font-medium text-[var(--color-primary)] hover:underline line-clamp-2">
                      {item.product.name}
                    </Link>
                    <p className="mt-1 text-sm font-bold">{item.product.price.toFixed(2)} &#8372;</p>
                    <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
                      Переглянуто: {formatDateTime(item.viewedAt)}
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
            <div className="flex justify-center py-8"><Spinner size="md" /></div>
          ) : addresses.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">Адреси відсутні</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {addresses.map((addr) => (
                <div key={addr.id} className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                  <div className="flex items-center gap-2">
                    {addr.label && <span className="text-sm font-medium">{addr.label}</span>}
                    {addr.isDefault && (
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">За замовчуванням</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm">{addr.city}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {[addr.street, addr.building && `буд. ${addr.building}`, addr.apartment && `кв. ${addr.apartment}`].filter(Boolean).join(', ') || '—'}
                  </p>
                  {addr.postalCode && <p className="text-xs text-[var(--color-text-secondary)]">Індекс: {addr.postalCode}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Audit log */}
      {activeTab === 'audit' && (
        <div>
          {auditLoading ? (
            <div className="flex justify-center py-8"><Spinner size="md" /></div>
          ) : auditLog.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">Записів немає</p>
          ) : (
            <div className="space-y-2">
              {auditLog.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
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
                        Виконав: {entry.user.fullName}
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
                      <p className="text-[10px] text-[var(--color-text-secondary)]">IP: {entry.ipAddress}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit profile modal */}
      <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title="Редагувати профіль">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Ім&apos;я</label>
            <Input value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Email</label>
            <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Телефон</label>
            <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Компанія</label>
            <Input value={editForm.companyName} onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">ЄДРПОУ</label>
            <Input value={editForm.edrpou} onChange={(e) => setEditForm({ ...editForm, edrpou: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Юридична адреса</label>
            <Input value={editForm.legalAddress} onChange={(e) => setEditForm({ ...editForm, legalAddress: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsEditing(false)}>Скасувати</Button>
            <Button onClick={handleSaveProfile}>Зберегти</Button>
          </div>
        </div>
      </Modal>

      {/* Block modal */}
      <Modal isOpen={showBlockModal} onClose={() => setShowBlockModal(false)} title="Заблокувати користувача">
        <div className="space-y-3">
          <p className="text-sm">Заблокувати <b>{user.fullName}</b>? Всі сесії будуть завершені.</p>
          <Input
            placeholder="Причина блокування (необов'язково)"
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowBlockModal(false)}>Скасувати</Button>
            <Button variant="danger" onClick={handleBlock}>Заблокувати</Button>
          </div>
        </div>
      </Modal>

      {/* Reset password modal */}
      <Modal isOpen={showResetModal} onClose={() => { setShowResetModal(false); setTempPassword(''); }} title="Скидання пароля">
        <div className="space-y-3">
          {!tempPassword ? (
            <>
              <p className="text-sm">
                Скинути пароль для <b>{user.fullName}</b> ({user.email})?
                Буде згенеровано тимчасовий пароль. Всі сесії будуть завершені.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowResetModal(false)}>Скасувати</Button>
                <Button onClick={handleResetPassword}>Скинути</Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm">Новий тимчасовий пароль:</p>
              <div className="flex items-center gap-2 rounded-[var(--radius)] bg-[var(--color-bg-secondary)] p-3">
                <code className="flex-1 text-lg font-bold tracking-wider">{tempPassword}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { navigator.clipboard.writeText(tempPassword); showResult('success', 'Скопійовано'); }}
                >
                  Копіювати
                </Button>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Передайте цей пароль клієнту. Він зможе змінити його в особистому кабінеті.
              </p>
              <div className="flex justify-end">
                <Button onClick={() => { setShowResetModal(false); setTempPassword(''); }}>Закрити</Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Send message modal */}
      <Modal isOpen={showMessageModal} onClose={() => setShowMessageModal(false)} title="Надіслати повідомлення">
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Надіслати повідомлення для <b>{user.fullName}</b>
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Канали</label>
            <div className="flex gap-3">
              {[
                { key: 'email', label: 'Email' },
                { key: 'telegram', label: 'Telegram' },
                { key: 'viber', label: 'Viber' },
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
              <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Тема (для email)</label>
              <Input
                value={messageSubject}
                onChange={(e) => setMessageSubject(e.target.value)}
                placeholder="Тема листа"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Повідомлення</label>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Текст повідомлення..."
              rows={4}
              className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowMessageModal(false)}>Скасувати</Button>
            <Button onClick={handleSendMessage} isLoading={isSendingMessage} disabled={!messageText.trim() || messageChannels.length === 0}>
              Надіслати
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete account modal */}
      <Modal isOpen={showDeleteModal} onClose={() => { setShowDeleteModal(false); setDeleteConfirm(''); }} title="Видалення акаунту">
        <div className="space-y-3">
          <div className="rounded bg-red-50 p-3 text-sm text-red-700">
            <b>Увага!</b> Ця дія незворотна. Всі персональні дані користувача будуть анонімізовані,
            замовлення збережуться без прив&apos;язки до особи.
          </div>
          <p className="text-sm">
            Для підтвердження видалення акаунту <b>{user.fullName}</b> ({user.email})
            введіть <code className="rounded bg-[var(--color-bg-secondary)] px-1.5 py-0.5 font-bold">ВИДАЛИТИ</code>:
          </p>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="Введіть ВИДАЛИТИ"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}>Скасувати</Button>
            <Button variant="danger" onClick={handleDeleteAccount} isLoading={isDeleting} disabled={deleteConfirm !== 'ВИДАЛИТИ'}>
              Видалити назавжди
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
      <h3 className="mb-3 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">{title}</h3>
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

function StatCard({ label, value, color, bg }: { label: string; value: string | number; color: string; bg: string }) {
  return (
    <div className={`rounded-xl ${bg} px-4 py-3`}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{label}</p>
    </div>
  );
}
