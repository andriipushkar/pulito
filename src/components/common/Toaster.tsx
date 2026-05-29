'use client';

// Import Sonner's stylesheet statically so it's bundled by Next.js and served
// as a same-origin <link> (allowed by CSP `style-src-elem 'self'`). Sonner
// otherwise injects its CSS via a runtime <style> element with no nonce, which
// our nonce-only style-src-elem directive blocks — leaving every toast
// unstyled and effectively invisible (so actions looked like they did nothing).
import 'sonner/dist/styles.css';
import { Toaster as SonnerToaster } from 'sonner';

export default function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        style: {
          background: 'var(--color-bg)',
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
        },
      }}
      richColors
      closeButton
    />
  );
}
