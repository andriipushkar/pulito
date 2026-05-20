// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import WysiwygEditor from './WysiwygEditor';

describe('WysiwygEditor', () => {
  afterEach(() => cleanup());

  it('renders toolbar and editor area', async () => {
    let result: ReturnType<typeof render> | undefined;
    await act(async () => {
      result = render(<WysiwygEditor value="" onChange={vi.fn()} />);
    });
    expect(result!.container.querySelector('.ProseMirror')).toBeInTheDocument();
    // Sanity-check a few toolbar buttons are present
    expect(result!.getByTitle(/Жирний/)).toBeInTheDocument();
    expect(result!.getByTitle(/таблицю/i)).toBeInTheDocument();
    expect(result!.getByTitle(/Заголовок 2/)).toBeInTheDocument();
  });

  it('renders initial value', async () => {
    let result: ReturnType<typeof render> | undefined;
    await act(async () => {
      result = render(<WysiwygEditor value="<p>Hello</p>" onChange={vi.fn()} />);
    });
    const editor = result!.container.querySelector('.ProseMirror');
    expect(editor?.textContent).toContain('Hello');
  });
});
