// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useContext } from 'react';
import SettingsProvider, { SettingsContext } from './SettingsProvider';
import { DEFAULT_SETTINGS, type SiteSettings } from '@/types/settings';

function TestConsumer() {
  const settings = useContext(SettingsContext);
  return (
    <div>
      <div data-testid="settings">{settings ? JSON.stringify(settings) : 'null'}</div>
      <div data-testid="site-name">{settings?.site_name ?? 'none'}</div>
      <div data-testid="site-email">{settings?.site_email ?? 'none'}</div>
    </div>
  );
}

describe('SettingsProvider', () => {
  afterEach(() => {
    cleanup();
  });

  it('provides settings to children', () => {
    render(
      <SettingsProvider settings={DEFAULT_SETTINGS}>
        <TestConsumer />
      </SettingsProvider>,
    );

    expect(screen.getByTestId('site-name').textContent).toBe('Pulito Trade');
    expect(screen.getByTestId('site-email').textContent).toBe('info@pulito.trade');
  });

  it('provides custom settings', () => {
    const customSettings: SiteSettings = {
      ...DEFAULT_SETTINGS,
      site_name: 'Custom Shop',
      site_email: 'custom@shop.com',
    };

    render(
      <SettingsProvider settings={customSettings}>
        <TestConsumer />
      </SettingsProvider>,
    );

    expect(screen.getByTestId('site-name').textContent).toBe('Custom Shop');
    expect(screen.getByTestId('site-email').textContent).toBe('custom@shop.com');
  });

  it('context is null outside provider', () => {
    render(<TestConsumer />);

    expect(screen.getByTestId('settings').textContent).toBe('null');
    expect(screen.getByTestId('site-name').textContent).toBe('none');
  });

  it('provides all default settings fields', () => {
    render(
      <SettingsProvider settings={DEFAULT_SETTINGS}>
        <TestConsumer />
      </SettingsProvider>,
    );

    const parsed = JSON.parse(screen.getByTestId('settings').textContent!);
    expect(parsed.site_phone).toBe(DEFAULT_SETTINGS.site_phone);
    expect(parsed.working_hours).toBe(DEFAULT_SETTINGS.working_hours);
    expect(parsed.free_delivery_threshold).toBe(DEFAULT_SETTINGS.free_delivery_threshold);
    expect(parsed.maintenance_mode).toBe('false');
  });

  it('updates when new settings prop is passed', () => {
    const { rerender } = render(
      <SettingsProvider settings={DEFAULT_SETTINGS}>
        <TestConsumer />
      </SettingsProvider>,
    );

    expect(screen.getByTestId('site-name').textContent).toBe('Pulito Trade');

    rerender(
      <SettingsProvider settings={{ ...DEFAULT_SETTINGS, site_name: 'Updated' }}>
        <TestConsumer />
      </SettingsProvider>,
    );

    expect(screen.getByTestId('site-name').textContent).toBe('Updated');
  });
});
