import { describe, it, expect } from 'vitest';
import { parseUaPostalAddress } from './address';

describe('parseUaPostalAddress', () => {
  it('parses the full "street, building, city, region, index" ordering', () => {
    expect(
      parseUaPostalAddress('проспект Червоної Калини, 40, Львів, Львівська область, 79036'),
    ).toEqual({
      streetAddress: 'проспект Червоної Калини, 40',
      addressLocality: 'Львів',
      addressRegion: 'Львівська область',
      postalCode: '79036',
    });
  });

  it('detects region and postal code regardless of street/building shape', () => {
    expect(parseUaPostalAddress('вул. Сихівська, 1А, Львів, Львівська обл., 79066')).toEqual({
      streetAddress: 'вул. Сихівська, 1А',
      addressLocality: 'Львів',
      addressRegion: 'Львівська обл.',
      postalCode: '79066',
    });
  });

  it('works without a postal code', () => {
    expect(parseUaPostalAddress('вул. Шевченка, 10, Київ, Київська область')).toEqual({
      streetAddress: 'вул. Шевченка, 10',
      addressLocality: 'Київ',
      addressRegion: 'Київська область',
    });
  });

  it('treats a lone city + index as the locality, not a street', () => {
    expect(parseUaPostalAddress('Львів, 79000')).toEqual({
      addressLocality: 'Львів',
      postalCode: '79000',
    });
  });

  it('returns an empty object for blank input', () => {
    expect(parseUaPostalAddress('')).toEqual({});
    expect(parseUaPostalAddress(null)).toEqual({});
    expect(parseUaPostalAddress(undefined)).toEqual({});
  });
});
