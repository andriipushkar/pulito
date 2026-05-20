import { describe, expect, it } from 'vitest';
import {
  canonicaliseKey,
  mapAttributesForMarketplace,
  parseSpecifications,
} from './marketplace-attributes';

describe('parseSpecifications', () => {
  it('returns empty for empty input', () => {
    expect(parseSpecifications(null)).toEqual({});
    expect(parseSpecifications('')).toEqual({});
  });

  it('parses colon-separated lines', () => {
    expect(parseSpecifications('Колір: Червоний\nРозмір: XL')).toEqual({
      'колір': 'Червоний',
      'розмір': 'XL',
    });
  });

  it('parses equal-sign and dash separators', () => {
    expect(parseSpecifications('Brand=Pulito\nMaterial — Cotton')).toEqual({
      brand: 'Pulito',
      material: 'Cotton',
    });
  });

  it('skips malformed lines', () => {
    expect(parseSpecifications('valid: value\nrandom text without separator')).toEqual({
      valid: 'value',
    });
  });
});

describe('canonicaliseKey', () => {
  it('maps Ukrainian to canonical', () => {
    expect(canonicaliseKey('Бренд')).toBe('brand');
    expect(canonicaliseKey('колір')).toBe('color');
    expect(canonicaliseKey('розмір')).toBe('size');
  });

  it('maps English aliases', () => {
    expect(canonicaliseKey('Colour')).toBe('color');
    expect(canonicaliseKey('Manufacturer')).toBe('brand');
  });

  it('passes unknown keys through (lowercased, underscore-spaced)', () => {
    expect(canonicaliseKey('Custom Field')).toBe('custom_field');
  });
});

describe('mapAttributesForMarketplace', () => {
  it('maps attributes to {key, value} array', () => {
    const r = mapAttributesForMarketplace({ Бренд: 'Pulito', Колір: 'Red' }, 'olx');
    expect(r).toEqual(
      expect.arrayContaining([
        { key: 'brand', value: 'Pulito' },
        { key: 'color', value: 'Red' },
      ]),
    );
  });
});
