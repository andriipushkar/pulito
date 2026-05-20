'use client';

import { useEffect, useRef } from 'react';

interface ContactMapProps {
  lat: number;
  lon: number;
  label?: string;
}

const markerSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
  <defs>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
      <feOffset dx="0" dy="2" />
      <feComponentTransfer><feFuncA type="linear" slope="0.4" /></feComponentTransfer>
      <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>
  <path d="M16 0C7.16 0 0 7.16 0 16c0 11 16 26 16 26s16-15 16-26C32 7.16 24.84 0 16 0z"
        fill="#E53935" filter="url(#shadow)" />
  <circle cx="16" cy="16" r="6" fill="white" />
</svg>`;

const markerDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(markerSvg.trim())}`;

/**
 * Renders the shop location on a Leaflet map (OSM tiles).
 *
 * We use Leaflet directly instead of an iframe embed (e.g. OpenStreetMap /
 * Google Maps embed.html). Cross-origin iframes get blocked by Firefox when
 * COOP/COEP/CSP combinations don't match the third-party document's headers,
 * which is the case for both OSM and Google Maps' free embeds. Loading tiles
 * as <img> elements via Leaflet sidesteps that entirely.
 *
 * Marker icon is an inline SVG (data URI) to avoid Leaflet's broken default
 * icon-path detection under webpack/Next.
 */
export default function ContactMap({ lat, lon, label }: ContactMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [lat, lon],
        zoom: 16,
        scrollWheelZoom: false,
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const icon = L.icon({
        iconUrl: markerDataUrl,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
        popupAnchor: [0, -38],
      });
      const marker = L.marker([lat, lon], { icon }).addTo(map);
      if (label) marker.bindPopup(label).openPopup();
    })();

    return () => {
      cancelled = true;
      const map = mapRef.current as { remove?: () => void } | null;
      map?.remove?.();
      mapRef.current = null;
    };
  }, [lat, lon, label]);

  return <div ref={containerRef} className="h-[300px] w-full" role="region" aria-label="Карта" />;
}
