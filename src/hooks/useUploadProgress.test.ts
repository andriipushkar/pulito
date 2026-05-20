// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUploadProgress } from './useUploadProgress';

// Mock XMLHttpRequest
class MockXHR {
  upload = { addEventListener: vi.fn() };
  addEventListener = vi.fn();
  open = vi.fn();
  send = vi.fn();
  setRequestHeader = vi.fn();
  responseText = '';
  static instances: MockXHR[] = [];

  constructor() {
    MockXHR.instances.push(this);
  }

  // Simulate upload progress
  simulateProgress(loaded: number, total: number) {
    const progressHandler = this.upload.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'progress'
    )?.[1];
    if (progressHandler) {
      progressHandler({ lengthComputable: true, loaded, total });
    }
  }

  // Simulate successful load
  simulateLoad(responseText: string) {
    this.responseText = responseText;
    const loadHandler = this.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'load'
    )?.[1];
    if (loadHandler) {
      loadHandler();
    }
  }

  // Simulate error
  simulateError() {
    const errorHandler = this.addEventListener.mock.calls.find(
      (call: unknown[]) => call[0] === 'error'
    )?.[1];
    if (errorHandler) {
      errorHandler();
    }
  }
}

describe('useUploadProgress', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    MockXHR.instances = [];
    (global as Record<string, unknown>).XMLHttpRequest = MockXHR;
  });

  it('starts with initial state', () => {
    const { result } = renderHook(() => useUploadProgress());

    expect(result.current.isUploading).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('sets isUploading when upload starts', () => {
    const { result } = renderHook(() => useUploadProgress());

    act(() => {
      result.current.upload('/upload', new FormData());
    });

    expect(result.current.isUploading).toBe(true);
    expect(result.current.progress).toBe(0);
  });

  it('tracks progress from 0 to 100', async () => {
    const { result } = renderHook(() => useUploadProgress());

    act(() => {
      result.current.upload('/upload', new FormData());
    });

    const xhr = MockXHR.instances[0];

    act(() => {
      xhr.simulateProgress(50, 100);
    });

    expect(result.current.progress).toBe(50);

    act(() => {
      xhr.simulateProgress(100, 100);
    });

    expect(result.current.progress).toBe(100);
  });

  it('completes upload on load', async () => {
    const { result } = renderHook(() => useUploadProgress());

    let uploadPromise: Promise<unknown>;
    act(() => {
      uploadPromise = result.current.upload('/upload', new FormData());
    });

    const xhr = MockXHR.instances[0];

    await act(async () => {
      xhr.simulateLoad(JSON.stringify({ success: true }));
      await uploadPromise!;
    });

    expect(result.current.isUploading).toBe(false);
    expect(result.current.progress).toBe(100);
    expect(result.current.error).toBeNull();
  });

  it('handles upload error', async () => {
    const { result } = renderHook(() => useUploadProgress());

    let uploadPromise: Promise<unknown>;
    act(() => {
      uploadPromise = result.current.upload('/upload', new FormData());
    });

    const xhr = MockXHR.instances[0];

    await act(async () => {
      xhr.simulateError();
      try {
        await uploadPromise!;
      } catch {
        // Expected rejection
      }
    });

    expect(result.current.isUploading).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBe('Помилка завантаження');
  });

  it('reset clears state', async () => {
    const { result } = renderHook(() => useUploadProgress());

    act(() => {
      result.current.upload('/upload', new FormData());
    });

    const xhr = MockXHR.instances[0];

    act(() => {
      xhr.simulateProgress(50, 100);
    });

    expect(result.current.progress).toBe(50);

    act(() => {
      result.current.reset();
    });

    expect(result.current.isUploading).toBe(false);
    expect(result.current.progress).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('opens XHR with correct URL and method', () => {
    const { result } = renderHook(() => useUploadProgress());

    act(() => {
      result.current.upload('/api/upload', new FormData());
    });

    const xhr = MockXHR.instances[0];
    expect(xhr.open).toHaveBeenCalledWith('POST', '/api/upload');
  });

  it('sends the FormData', () => {
    const { result } = renderHook(() => useUploadProgress());
    const fd = new FormData();

    act(() => {
      result.current.upload('/upload', fd);
    });

    const xhr = MockXHR.instances[0];
    expect(xhr.send).toHaveBeenCalledWith(fd);
  });

  it('parses JSON response', async () => {
    const { result } = renderHook(() => useUploadProgress());

    let uploadPromise: Promise<unknown>;
    act(() => {
      uploadPromise = result.current.upload('/upload', new FormData());
    });

    const xhr = MockXHR.instances[0];
    let resolvedValue: unknown;

    await act(async () => {
      xhr.simulateLoad(JSON.stringify({ id: 42, url: '/image.png' }));
      resolvedValue = await uploadPromise!;
    });

    expect(resolvedValue).toEqual({ id: 42, url: '/image.png' });
  });
});
