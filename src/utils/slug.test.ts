import { describe, it, expect } from 'vitest';
import { createSlug } from './slug';

describe('createSlug', () => {
  it('should transliterate Ukrainian text to a slug', () => {
    expect(createSlug('Миючі засоби')).toBe('miyuchi-zasobi');
  });

  it('should convert to lowercase', () => {
    expect(createSlug('Hello World')).toBe('hello-world');
  });

  it('should remove special characters', () => {
    expect(createSlug('Fairy Лимон 450мл!')).toBe('fairy-limon-450ml');
  });

  it('should trim whitespace', () => {
    expect(createSlug('  пральні порошки  ')).toBe('pralni-poroshki');
  });

  it('should handle multiple spaces between words', () => {
    const slug = createSlug('засоби   для   кухні');
    expect(slug).toBe('zasobi-dlya-kuhni');
  });

  it('should handle empty string', () => {
    expect(createSlug('')).toBe('');
  });

  it('should handle purely numeric input', () => {
    expect(createSlug('12345')).toBe('12345');
  });

  it('should handle mixed Cyrillic and Latin', () => {
    const slug = createSlug('Persil Power Gel гель для прання');
    expect(slug).toBe('persil-power-gel-gel-dlya-prannya');
  });

  it('should cap long slugs at the default max length, on a word boundary', () => {
    const long =
      'Еліксир парфумований для ополіскування тканин Coccolino Elixir Campanula Selvatica Bergamotto 342 мл';
    const slug = createSlug(long);
    expect(slug.length).toBeLessThanOrEqual(70);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('should respect a custom max length', () => {
    const slug = createSlug('Persil Power Gel гель для прання кольорових тканин', 20);
    expect(slug.length).toBeLessThanOrEqual(20);
    expect(slug.startsWith('persil')).toBe(true);
  });
});
