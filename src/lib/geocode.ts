/**
 * Address → coordinates via OpenStreetMap Nominatim.
 *
 * Nominatim's usage policy requires a descriptive User-Agent and reasonable
 * call volume. We rely on Next.js fetch ISR (revalidate 24h) so we hit them
 * at most once per address per day per server instance.
 */
export interface GeoPoint {
  lat: number;
  lon: number;
}

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const trimmed = address?.trim();
  if (!trimmed) return null;

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=1&accept-language=uk`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'pulito.trade contacts page' },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat?: string; lon?: string }[];
    const first = data[0];
    if (!first?.lat || !first?.lon) return null;
    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

/**
 * Builds an OpenStreetMap embed iframe URL for the given point.
 * Bbox is centered on the point with a ~600m span so the marker is clearly visible.
 */
export function osmEmbedUrl({ lat, lon }: GeoPoint, span = 0.005): string {
  const minLon = (lon - span).toFixed(6);
  const maxLon = (lon + span).toFixed(6);
  const minLat = (lat - span / 2).toFixed(6);
  const maxLat = (lat + span / 2).toFixed(6);
  const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
}
