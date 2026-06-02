// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Local next-intl mock: resolve real Ukrainian copy (with ICU) from messages so
// translated-text assertions match production, overriding the global passthrough.
vi.mock('next-intl', async (importActual) => {
  const actual = await importActual<any>();
  const uk = (await import('@/messages/uk.json')).default;
  return {
    ...actual,
    useTranslations: (ns?: string) =>
      actual.createTranslator({ locale: 'uk', messages: uk, namespace: ns }),
    useLocale: () => 'uk',
    useFormatter: () => actual.createFormatter({ locale: 'uk' }),
  };
});

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
