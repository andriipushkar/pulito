export interface ParsedPostalAddress {
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
}

/**
 * Parse a free-form Ukrainian address string into schema.org PostalAddress
 * parts. Expects the common ordering "street, building, city, region, index",
 * e.g. "проспект Червоної Калини, 40, Львів, Львівська область, 79036" →
 *   { streetAddress: "проспект Червоної Калини, 40",
 *     addressLocality: "Львів",
 *     addressRegion: "Львівська область",
 *     postalCode: "79036" }
 *
 * A 5-digit postal code and an "…область/обл." region are detected wherever
 * they sit; the city is taken as the last remaining segment and the street as
 * everything before it. Previously the layout naively split on the first comma
 * and treated the street ("проспект Червоної Калини") as the city.
 */
export function parseUaPostalAddress(raw: string | null | undefined): ParsedPostalAddress {
  const parts = (raw || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return {};

  let postalCode: string | undefined;
  let addressRegion: string | undefined;
  const rest: string[] = [];

  for (const part of parts) {
    if (!postalCode && /^\d{5}$/.test(part)) {
      postalCode = part;
      // NB: no \b before Cyrillic — JS \b uses ASCII \w, so it never matches a
      // word boundary next to Cyrillic letters. Anchor on the suffix instead.
    } else if (!addressRegion && /(область|обл\.?)$/i.test(part)) {
      addressRegion = part;
    } else {
      rest.push(part);
    }
  }

  // City is the last descriptive segment (UA ordering); keep ≥1 part as street.
  // With a single segment we only call it the locality when a region/postal
  // code disambiguates it as a standalone city rather than a street.
  let addressLocality: string | undefined;
  if (rest.length > 1 || (rest.length === 1 && (postalCode || addressRegion))) {
    addressLocality = rest.pop();
  }

  const streetAddress = rest.join(', ') || undefined;

  return {
    ...(streetAddress && { streetAddress }),
    ...(addressLocality && { addressLocality }),
    ...(addressRegion && { addressRegion }),
    ...(postalCode && { postalCode }),
  };
}
