'use client';

import { useState, useCallback } from 'react';

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
}

export function useUploadProgress() {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
  });

  const upload = useCallback(async (url: string, formData: FormData): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      setState({ isUploading: true, progress: 0, error: null });

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setState((prev) => ({ ...prev, progress: pct }));
        }
      });

      xhr.addEventListener('load', () => {
        setState({ isUploading: false, progress: 100, error: null });
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve(xhr.responseText);
        }
      });

      xhr.addEventListener('error', () => {
        const err = 'Помилка завантаження';
        setState({ isUploading: false, progress: 0, error: err });
        reject(new Error(err));
      });

      xhr.open('POST', url);
      xhr.send(formData);
    });
  }, []);

  const reset = useCallback(() => {
    setState({ isUploading: false, progress: 0, error: null });
  }, []);

  return { ...state, upload, reset };
}
