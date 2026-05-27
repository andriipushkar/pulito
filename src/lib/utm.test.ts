// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { captureUtmsFromUrl, readStoredUtms } from './utm';

function clearCookies() {
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0].trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

describe('utm capture', () => {
  beforeEach(() => {
    clearCookies();
    window.history.replaceState({}, '', '/');
  });

  it('captures UTMs from URL into cookie', () => {
    window.history.replaceState(
      {},
      '',
      '/?utm_source=telegram&utm_medium=bot&utm_campaign=new_arrivals',
    );
    const captured = captureUtmsFromUrl();
    expect(captured).toEqual({
      utmSource: 'telegram',
      utmMedium: 'bot',
      utmCampaign: 'new_arrivals',
    });
    expect(readStoredUtms()).toEqual(captured);
  });

  it('returns stored UTMs on visit without UTM params (first-touch persistence)', () => {
    window.history.replaceState({}, '', '/?utm_source=instagram&utm_campaign=spring');
    captureUtmsFromUrl();

    window.history.replaceState({}, '', '/catalog');
    const result = captureUtmsFromUrl();
    expect(result?.utmSource).toBe('instagram');
    expect(result?.utmCampaign).toBe('spring');
  });

  it('overwrites stored UTMs when new ones arrive (last-touch within session)', () => {
    window.history.replaceState({}, '', '/?utm_source=email&utm_campaign=winback');
    captureUtmsFromUrl();

    window.history.replaceState({}, '', '/?utm_source=telegram&utm_medium=bot&utm_campaign=promo');
    const result = captureUtmsFromUrl();
    expect(result).toEqual({
      utmSource: 'telegram',
      utmMedium: 'bot',
      utmCampaign: 'promo',
    });
  });

  it('returns null when no UTMs on URL and none stored', () => {
    expect(captureUtmsFromUrl()).toBeNull();
    expect(readStoredUtms()).toBeNull();
  });

  it('clamps values to 100 chars to prevent DB bloat', () => {
    const longCampaign = 'a'.repeat(500);
    window.history.replaceState({}, '', `/?utm_campaign=${longCampaign}`);
    const captured = captureUtmsFromUrl();
    expect(captured?.utmCampaign?.length).toBe(100);
  });
});
