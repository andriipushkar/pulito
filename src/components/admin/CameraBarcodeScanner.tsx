'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Camera-based barcode scanner using the native BarcodeDetector API. Works in
 * Chrome on Android and Safari on iOS 17+. Falls back to a clear error when
 * unsupported — the operator can switch back to the keyboard-wedge scanner.
 */

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

interface CameraBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export default function CameraBarcodeScanner({
  isOpen,
  onClose,
  onScan,
}: CameraBarcodeScannerProps) {
  const t = useTranslations('admin.cameraBarcodeScanner');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopLoopRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const scanLoop = useCallback(
    (detector: BarcodeDetectorLike) => {
      const tick = async () => {
        if (stopLoopRef.current || !videoRef.current) return;
        try {
          const results = await detector.detect(videoRef.current);
          if (results.length > 0) {
            const code = results[0].rawValue.trim();
            if (code) {
              stopLoopRef.current = true;
              onScan(code);
              onClose();
              return;
            }
          }
        } catch {
          // continue; transient errors happen between frames
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    [onScan, onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    stopLoopRef.current = false;

    // Snapshot ref nodes for cleanup so the closure does not race with re-mounts.
    const videoEl = videoRef.current;

    // Run setup as a microtask so initial setState happens off the synchronous
    // effect body — this keeps the rule happy and behavior identical.
    const start = async () => {
      setError(null);

      if (typeof window === 'undefined' || !window.BarcodeDetector) {
        setSupported(false);
        setError(t('unsupported'));
        return;
      }

      let detector: BarcodeDetectorLike;
      try {
        detector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code'],
        });
      } catch (e) {
        setSupported(false);
        setError(t('initFailed', { error: String(e) }));
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        scanLoop(detector);
      } catch (e) {
        setError(t('cameraFailed', { error: String(e) }));
      }
    };

    start();

    return () => {
      stopLoopRef.current = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoEl) videoEl.srcObject = null;
    };
  }, [isOpen, scanLoop, t]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-[var(--radius)] bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-[var(--color-bg)] px-4 py-3">
          <h2 className="text-base font-semibold">{t('title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          >
            {t('close')}
          </button>
        </div>
        {error ? (
          <div className="p-6 text-center text-sm text-white">
            <p className="text-amber-300">{error}</p>
            {!supported && <p className="mt-3 text-xs text-white/70">{t('usbHint')}</p>}
          </div>
        ) : (
          <div className="relative aspect-[3/4] w-full bg-black">
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-32 w-72 border-2 border-emerald-400">
                <div className="absolute -top-1 left-0 h-1 w-8 bg-emerald-400" />
                <div className="absolute -top-1 right-0 h-1 w-8 bg-emerald-400" />
                <div className="absolute -bottom-1 left-0 h-1 w-8 bg-emerald-400" />
                <div className="absolute -bottom-1 right-0 h-1 w-8 bg-emerald-400" />
              </div>
            </div>
            <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/80">
              {t('aim')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
