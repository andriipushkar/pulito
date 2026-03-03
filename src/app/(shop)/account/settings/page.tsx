'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import Input from '@/components/ui/Input';
import PhoneInput, { cleanPhone } from '@/components/ui/PhoneInput';
import Button from '@/components/ui/Button';

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
    <div className="space-y-8">
      <div>
        <h2 className="mb-4 text-lg font-semibold">Персональні дані</h2>
        <div className="max-w-md space-y-4 rounded-[var(--radius)] border border-[var(--color-border)] p-6">
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
            <p className={`text-sm ${profileMessage.type === 'success' ? 'text-green-600' : 'text-[var(--color-danger)]'}`}>
              {profileMessage.text}
            </p>
          )}
          <Button onClick={handleProfileSave} isLoading={isSavingProfile}>
            Зберегти
          </Button>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Зміна пароля</h2>
        <div className="max-w-md space-y-4 rounded-[var(--radius)] border border-[var(--color-border)] p-6">
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
            <p className={`text-sm ${passwordMessage.type === 'success' ? 'text-green-600' : 'text-[var(--color-danger)]'}`}>
              {passwordMessage.text}
            </p>
          )}
          <Button onClick={handlePasswordChange} isLoading={isSavingPassword}>
            Змінити пароль
          </Button>
        </div>
      </div>

      {/* Google account linking */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Google акаунт</h2>
        <div className="max-w-md space-y-4 rounded-[var(--radius)] border border-[var(--color-border)] p-6">
          {googleStatus === null ? (
            <p className="text-sm text-[var(--color-text-secondary)]">Завантаження...</p>
          ) : googleStatus.hasGoogle ? (
            <>
              <div className="flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 2.58z" fill="#EA4335"/>
                </svg>
                <span className="text-sm font-medium text-green-600">Google підключено</span>
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
                className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 2.58z" fill="#EA4335"/>
                </svg>
                Підключити Google
              </a>
            </>
          )}
          {googleMessage && (
            <p className={`text-sm ${googleMessage.type === 'success' ? 'text-green-600' : 'text-[var(--color-danger)]'}`}>
              {googleMessage.text}
            </p>
          )}
        </div>
      </div>

      {/* Account deletion (GDPR) */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-danger)]">Видалити акаунт</h2>
        <div className="max-w-md space-y-4 rounded-[var(--radius)] border border-[var(--color-danger)]/30 p-6">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Ця дія незворотна. Усі ваші персональні дані буде анонімізовано, а доступ до акаунту — припинено.
            Історія замовлень збережеться в знеособленому вигляді.
          </p>

          {!showDeleteConfirm ? (
            <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
              Видалити акаунт
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                Для підтвердження введіть <span className="font-bold">ВИДАЛИТИ</span>:
              </p>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="ВИДАЛИТИ"
              />
              {deleteMessage && (
                <p className={`text-sm ${deleteMessage.type === 'success' ? 'text-green-600' : 'text-[var(--color-danger)]'}`}>
                  {deleteMessage.text}
                </p>
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
      </div>
    </div>
  );
}
