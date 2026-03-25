'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';

/**
 * Swagger UI page that renders the OpenAPI spec from /openapi.json.
 * Uses swagger-ui-dist from CDN to avoid adding ~5MB to the bundle.
 */
export default function ApiDocsPage() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // SwaggerUI will be initialized after the script loads
    const tryInit = () => {
      const SwaggerUI = (window as any).SwaggerUIBundle;
      if (!SwaggerUI) return;

      SwaggerUI({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUI.presets.apis, (window as any).SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout',
      });
    };

    // If already loaded (e.g., client-side navigation)
    if ((window as any).SwaggerUIBundle) {
      tryInit();
    } else {
      window.addEventListener('swagger-ready', tryInit, { once: true });
    }

    return () => {
      window.removeEventListener('swagger-ready', tryInit);
    };
  }, []);

  return (
    <>
      {}
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
      <Script
        src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"
        strategy="afterInteractive"
        onLoad={() => {
          window.dispatchEvent(new Event('swagger-ready'));
        }}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js"
        strategy="afterInteractive"
      />
      <div id="swagger-ui" style={{ minHeight: '100vh' }} />
    </>
  );
}
