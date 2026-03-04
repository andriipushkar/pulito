'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import Input from '@/components/ui/Input';
import PhoneInput, { cleanPhone } from '@/components/ui/PhoneInput';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/account/PageHeader';
import SectionCard from '@/components/account/SectionCard';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [profileData, setProfileData] = useState({
    fullName: user?.fullName || '',
    phone: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Account deletion state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Google link/unlink state
  const [googleStatus, setGoogleStatus] = useState<{ hasGoogle: boolean; hasPassword: boolean } | null>(null);
  const [googleMessage, setGoogleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isUnlinkingGoogle, setIsUnlinkingGoogle] = useState(false);

  useEffect(() => {
    apiClient.get<{ hasGoogle: boolean; hasPassword: boolean }>('/api/v1/me/account/google').then((res) => {
      if (res.success && res.data) {
        setGoogleStatus(res.data);
      }
    });
  }, []);

  const handleGoogleUnlink = async () => {
    setIsUnlinkingGoogle(true);
    setGoogleMessage(null);
    try {
      const res = await apiClient.delete('/api/v1/me/account/google');
      if (res.success) {
        setGoogleStatus((prev) => (prev ? { ...prev, hasGoogle: false } : null));
        setGoogleMessage({ type: 'success', text: 'Google акаунт від\'єднано' });
      } else {
        setGoogleMessage({ type: 'error', text: res.error || 'Помилка від\'єднання' });
      }
    } catch {
      setGoogleMessage({ type: 'error', text: 'Помилка мережі' });
    } finally {
      setIsUnlinkingGoogle(false);
    }
  };

  const handleDeleteAccount = useCallback(async () => {
    if (deleteConfirmText !== 'ВИДАЛИТИ') return;

    setIsDeleting(true);
    setDeleteMessage(null);
    try {
      const res = await apiClient.delete('/api/v1/me/account');
      if (res.success) {
        setDeleteMessage({ type: 'success', text: 'Акаунт видалено. Перенаправлення...' });
        setTimeout(() => logout(), 1500);
      } else {
        setDeleteMessage({ type: 'error', text: res.error || 'Помилка видалення акаунту' });
      }
    } catch {
      setDeleteMessage({ type: 'error', text: 'Помилка мережі' });
    } finally {
      setIsDeleting(false);
    }
  }, [deleteConfirmText, logout]);

  const handleProfileSave = async () => {
    setIsSavingProfile(true);
    setProfileMessage(null);
    try {
      const res = await apiClient.put('/api/v1/auth/me', profileData);
      if (res.success) {
        setProfileMessage({ type: 'success', text: 'Профіль оновлено' });
      } else {
        setProfileMessage({ type: 'error', text: res.error || 'Помилка збереження' });
      }
    } catch {
      setProfileMessage({ type: 'error', text: 'Помилка мережі' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Паролі не збігаються' });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Мінімум 6 символів' });
      return;
    }

    setIsSavingPassword(true);
    setPasswordMessage(null);
    try {
      const res = await apiClient.put('/api/v1/auth/me', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      if (res.success) {
        setPasswordMessage({ type: 'success', text: 'Пароль змінено' });
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPasswordMessage({ type: 'error', text: res.error || 'Помилка зміни пароля' });
      }
    } catch {
      setPasswordMessage({ type: 'error', text: 'Помилка мережі' });
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
        title="Налаштування"
        subtitle="Профіль та безпека"
      />

      {/* ── Profile data ── */}
      <SectionCard
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        }
        title="Персональні дані"
      >
        <div className="max-w-md space-y-4">
          <Input label="Email" value={user?.email || ''} disabled />
          <Input
            label="Прізвище та ім'я"
            value={profileData.fullName}
            onChange={(e) => setProfileData((p) => ({ ...p, fullName: e.target.value }))}
          />
          <PhoneInput
            label="Телефон"
            value={profileData.phone}
            onChange={(e) => setProfileData((p) => ({ ...p, phone: cleanPhone(e.target.value) }))}
          />
          {profileMessage && (
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
              profileMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-[var(--color-danger)]'
            }`}>
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={
                  profileMessage.type === 'success'
                    ? 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                    : 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z'
                } />
              </svg>
              {profileMessage.text}
            </div>
          )}
          <Button onClick={handleProfileSave} isLoading={isSavingProfile}>
            Зберегти
          </Button>
        </div>
      </SectionCard>

      {/* ── Password change ── */}
      <SectionCard
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        }
        title="Зміна пароля"
      >
        <div className="max-w-md space-y-4">
          <Input
            label="Поточний пароль"
            type="password"
            value={passwordData.currentPassword}
            onChange={(e) => setPasswordData((p) => ({ ...p, currentPassword: e.target.value }))}
          />
          <Input
            label="Новий пароль"
            type="password"
            value={passwordData.newPassword}
            onChange={(e) => setPasswordData((p) => ({ ...p, newPassword: e.target.value }))}
          />
          <Input
            label="Підтвердження нового пароля"
            type="password"
            value={passwordData.confirmPassword}
            onChange={(e) => setPasswordData((p) => ({ ...p, confirmPassword: e.target.value }))}
          />
          {passwordMessage && (
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
              passwordMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-[var(--color-danger)]'
            }`}>
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={
                  passwordMessage.type === 'success'
                    ? 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                    : 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z'
                } />
              </svg>
              {passwordMessage.text}
            </div>
          )}
          <Button onClick={handlePasswordChange} isLoading={isSavingPassword}>
            Змінити пароль
          </Button>
        </div>
      </SectionCard>

      {/* ── Google account ── */}
      <SectionCard
        icon={
          <svg width="20" height="20" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 2.58z" fill="#EA4335"/>
          </svg>
        }
        title="Google акаунт"
      >
        <div className="max-w-md space-y-4">
          {googleStatus === null ? (
            <p className="text-sm text-[var(--color-text-secondary)]">Завантаження...</p>
          ) : googleStatus.hasGoogle ? (
            <>
              <div className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2">
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-green-700">Google підключено</span>
              </div>
              {!googleStatus.hasPassword && (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Щоб від&apos;єднати Google, спочатку встановіть пароль для акаунту.
                </p>
              )}
              <Button
                variant="outline"
                onClick={handleGoogleUnlink}
                isLoading={isUnlinkingGoogle}
                disabled={!googleStatus.hasPassword}
              >
                Від&apos;єднати
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Підключіть Google акаунт для швидкого входу.
              </p>
              <a
                href="/api/v1/auth/google"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 2.58z" fill="#EA4335"/>
                </svg>
                Підключити Google
              </a>
            </>
          )}
          {googleMessage && (
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
              googleMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-[var(--color-danger)]'
            }`}>
              {googleMessage.text}
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Account deletion ── */}
      <SectionCard
        icon={
          <svg className="h-5 w-5 text-[var(--color-danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        }
        title="Видалити акаунт"
        className="border-red-200/60"
      >
        <div className="max-w-md space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Ця дія незворотна. Усі ваші персональні дані буде анонімізовано, а доступ до акаунту — припинено.
            Історія замовлень збережеться в знеособленому вигляді.
          </p>

          {!showDeleteConfirm ? (
            <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
              Видалити акаунт
            </Button>
          ) : (
            <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/50 p-4">
              <p className="text-sm font-medium text-red-700">
                Для підтвердження введіть <span className="font-bold">ВИДАЛИТИ</span>:
              </p>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="ВИДАЛИТИ"
              />
              {deleteMessage && (
                <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                  deleteMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-[var(--color-danger)]'
                }`}>
                  {deleteMessage.text}
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  variant="danger"
                  onClick={handleDeleteAccount}
                  isLoading={isDeleting}
                  disabled={deleteConfirmText !== 'ВИДАЛИТИ'}
                >
                  Підтвердити видалення
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                    setDeleteMessage(null);
                  }}
                >
                  Скасувати
                </Button>
              </div>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
