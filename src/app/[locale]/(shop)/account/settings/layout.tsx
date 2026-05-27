import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Налаштування',
  description: 'Налаштування профілю, зміна пароля та керування акаунтом.',
  robots: { index: false, follow: false },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
