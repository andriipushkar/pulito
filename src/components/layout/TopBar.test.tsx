// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/link', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/components/ui/Container', () => ({ default: ({ children, ...props }: any) => <div {...props}>{children}</div> }));
vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    site_name: 'Порошок',
    site_phone: '+380001234567',
    site_phone_display: '+38 (000) 123-45-67',
    site_email: 'info@poroshok.ua',
    site_address: 'м. Київ',
    working_hours: 'Пн-Пт: 9:00-18:00',
    free_delivery_threshold: '2000',
    social_telegram: 'https://t.me/poroshok_shop',
    social_viber: 'viber://pa?chatURI=poroshok_shop',
    social_instagram: 'https://instagram.com/poroshok_shop',
    social_facebook: 'https://www.facebook.com/poroshok.shop',
    social_tiktok: 'https://www.tiktok.com/@poroshok_shop',
    maintenance_mode: 'false',
    company_description: 'Тестовий опис',
    company_legal_name: '', company_edrpou: '', company_ipn: '', company_iban: '', company_bank: '', company_legal_address: '', default_seo_title: '', default_seo_description: '', google_analytics_id: '', facebook_pixel_id: '',
  }),
}));
vi.mock('@/components/icons', () => ({
  Telegram: () => <span data-testid="icon" />,
  Viber: () => <span data-testid="icon" />,
  Instagram: () => <span data-testid="icon" />,
  Facebook: () => <span data-testid="icon" />,
  TikTok: () => <span data-testid="icon" />,
  Phone: () => <span data-testid="icon" />,
  HelpCircle: () => <span data-testid="icon" />,
  MessageCircle: () => <span data-testid="icon" />,
}));

import TopBar from './TopBar';

describe('TopBar', () => {
  it('renders without crashing', () => {
    const { container } = render(<TopBar />);
    expect(container).toBeTruthy();
  });

  it('renders social link aria-labels', () => {
    const { getAllByLabelText } = render(<TopBar />);
    expect(getAllByLabelText('Telegram').length).toBeGreaterThan(0);
    expect(getAllByLabelText('Instagram').length).toBeGreaterThan(0);
  });
});
