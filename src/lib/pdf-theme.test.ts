import { describe, it, expect } from 'vitest';
import { BRAND, PAGE, FONT_REGULAR, FONT_BOLD } from './pdf-theme';

describe('BRAND colors', () => {
  it('defines primary color as blue-600', () => {
    expect(BRAND.primary).toBe('#2563eb');
  });

  it('defines all required color groups', () => {
    // Primary colors
    expect(BRAND.primaryDark).toBeDefined();
    expect(BRAND.primaryLight).toBeDefined();
    // Text colors
    expect(BRAND.text).toBeDefined();
    expect(BRAND.textSecondary).toBeDefined();
    expect(BRAND.textMuted).toBeDefined();
    // Semantic colors
    expect(BRAND.success).toBeDefined();
    expect(BRAND.warning).toBeDefined();
    expect(BRAND.danger).toBeDefined();
  });

  it('all color values are valid hex strings', () => {
    for (const [key, value] of Object.entries(BRAND)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('PAGE layout constants', () => {
  it('defines A4 page dimensions', () => {
    expect(PAGE.width).toBe(595.28);
    expect(PAGE.height).toBe(841.89);
  });

  it('defines margin and content width', () => {
    expect(PAGE.margin).toBe(40);
    expect(PAGE.contentWidth).toBe(PAGE.width - 2 * PAGE.margin);
  });

  it('defines footer Y position', () => {
    expect(PAGE.footerY).toBe(790);
    expect(PAGE.footerY).toBeLessThan(PAGE.height);
  });
});

describe('Font paths', () => {
  it('FONT_REGULAR points to Roboto-Regular.ttf', () => {
    expect(FONT_REGULAR).toContain('Roboto-Regular.ttf');
  });

  it('FONT_BOLD points to Roboto-Bold.ttf', () => {
    expect(FONT_BOLD).toContain('Roboto-Bold.ttf');
  });
});
