// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import WysiwygEditor from './WysiwygEditor';

// Ensure document.execCommand exists in jsdom
const mockExecCommand = vi.fn().mockReturnValue(true);

describe('WysiwygEditor', () => {
  beforeEach(() => {
    mockExecCommand.mockClear();
    (document as any).execCommand = mockExecCommand;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(<WysiwygEditor value="" onChange={vi.fn()} />);
    expect(container).toBeTruthy();
  });

  it('renders contentEditable area', () => {
    const { container } = render(<WysiwygEditor value="" onChange={vi.fn()} />);
    expect(container.querySelector('[contenteditable]')).toBeInTheDocument();
  });

  it('sets initial value', () => {
    const { container } = render(<WysiwygEditor value="<p>Hello</p>" onChange={vi.fn()} />);
    expect(container.querySelector('[contenteditable]')?.innerHTML).toBe('<p>Hello</p>');
  });

  it('calls onChange on input', () => {
    const onChange = vi.fn();
    const { container } = render(<WysiwygEditor value="" onChange={onChange} />);
    const editor = container.querySelector('[contenteditable]') as HTMLElement;
    editor.innerHTML = '<p>new content</p>';
    fireEvent.input(editor);
    expect(onChange).toHaveBeenCalledWith('<p>new content</p>');
  });

  it('handles focus and blur', () => {
    const { container } = render(<WysiwygEditor value="" onChange={vi.fn()} />);
    const editor = container.querySelector('[contenteditable]') as HTMLElement;
    fireEvent.focus(editor);
    fireEvent.blur(editor);
  });

  it('applies className prop', () => {
    const { container } = render(<WysiwygEditor value="" onChange={vi.fn()} className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('sets data-placeholder attribute', () => {
    const { container } = render(<WysiwygEditor value="" onChange={vi.fn()} placeholder="Type here..." />);
    expect(container.querySelector('[data-placeholder="Type here..."]')).toBeInTheDocument();
  });

  it('updates content when value prop changes', () => {
    const { container, rerender } = render(<WysiwygEditor value="<p>A</p>" onChange={vi.fn()} />);
    expect(container.querySelector('[contenteditable]')?.innerHTML).toBe('<p>A</p>');
    rerender(<WysiwygEditor value="<p>B</p>" onChange={vi.fn()} />);
    expect(container.querySelector('[contenteditable]')?.innerHTML).toBe('<p>B</p>');
  });

  it('does not update content when value matches current innerHTML', () => {
    const { container } = render(<WysiwygEditor value="" onChange={vi.fn()} />);
    const editor = container.querySelector('[contenteditable]') as HTMLElement;
    editor.innerHTML = 'test';
  });

  it('executes bold command when Bold button is clicked', () => {
    const onChange = vi.fn();
    const { container } = render(<WysiwygEditor value="<p>text</p>" onChange={onChange} />);

    const boldBtn = Array.from(container.querySelectorAll('button')).find(b => b.title === 'Bold');
    expect(boldBtn).toBeTruthy();
    fireEvent.click(boldBtn!);

    expect(mockExecCommand).toHaveBeenCalledWith('bold', false, undefined);
    expect(onChange).toHaveBeenCalled();
  });

  it('executes italic command when Italic button is clicked', () => {
    const onChange = vi.fn();
    const { container } = render(<WysiwygEditor value="<p>text</p>" onChange={onChange} />);

    const italicBtn = Array.from(container.querySelectorAll('button')).find(b => b.title === 'Italic');
    fireEvent.click(italicBtn!);

    expect(mockExecCommand).toHaveBeenCalledWith('italic', false, undefined);
    expect(onChange).toHaveBeenCalled();
  });

  it('executes underline command when Underline button is clicked', () => {
    const { container } = render(<WysiwygEditor value="<p>text</p>" onChange={vi.fn()} />);

    const underlineBtn = Array.from(container.querySelectorAll('button')).find(b => b.title === 'Underline');
    fireEvent.click(underlineBtn!);

    expect(mockExecCommand).toHaveBeenCalledWith('underline', false, undefined);
  });

  it('executes formatBlock h2 command when H2 button is clicked', () => {
    const { container } = render(<WysiwygEditor value="<p>text</p>" onChange={vi.fn()} />);

    const h2Btn = Array.from(container.querySelectorAll('button')).find(b => b.title === 'Heading 2');
    fireEvent.click(h2Btn!);

    expect(mockExecCommand).toHaveBeenCalledWith('formatBlock', false, 'h2');
  });

  it('executes formatBlock h3 command when H3 button is clicked', () => {
    const { container } = render(<WysiwygEditor value="<p>text</p>" onChange={vi.fn()} />);

    const h3Btn = Array.from(container.querySelectorAll('button')).find(b => b.title === 'Heading 3');
    fireEvent.click(h3Btn!);

    expect(mockExecCommand).toHaveBeenCalledWith('formatBlock', false, 'h3');
  });

  it('executes formatBlock p command when Paragraph button is clicked', () => {
    const { container } = render(<WysiwygEditor value="<p>text</p>" onChange={vi.fn()} />);

    const pBtn = Array.from(container.querySelectorAll('button')).find(b => b.title === 'Paragraph');
    fireEvent.click(pBtn!);

    expect(mockExecCommand).toHaveBeenCalledWith('formatBlock', false, 'p');
  });

  it('executes insertUnorderedList command when Bullet list button is clicked', () => {
    const { container } = render(<WysiwygEditor value="<p>text</p>" onChange={vi.fn()} />);

    const ulBtn = Array.from(container.querySelectorAll('button')).find(b => b.title === 'Bullet list');
    fireEvent.click(ulBtn!);

    expect(mockExecCommand).toHaveBeenCalledWith('insertUnorderedList', false, undefined);
  });

  it('executes insertOrderedList command when Numbered list button is clicked', () => {
    const { container } = render(<WysiwygEditor value="<p>text</p>" onChange={vi.fn()} />);

    const olBtn = Array.from(container.querySelectorAll('button')).find(b => b.title === 'Numbered list');
    fireEvent.click(olBtn!);

    expect(mockExecCommand).toHaveBeenCalledWith('insertOrderedList', false, undefined);
  });

  it('executes createLink command when Link button is clicked and URL is provided', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('https://example.com');
    const { container } = render(<WysiwygEditor value="<p>text</p>" onChange={vi.fn()} />);

    const linkBtn = Array.from(container.querySelectorAll('button')).find(b => b.title === 'Link');
    fireEvent.click(linkBtn!);

    expect(window.prompt).toHaveBeenCalledWith('URL посилання:');
    expect(mockExecCommand).toHaveBeenCalledWith('createLink', false, 'https://example.com');
  });

  it('does not execute createLink when URL prompt is cancelled', () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null);
    const { container } = render(<WysiwygEditor value="<p>text</p>" onChange={vi.fn()} />);

    const linkBtn = Array.from(container.querySelectorAll('button')).find(b => b.title === 'Link');
    fireEvent.click(linkBtn!);

    expect(mockExecCommand).not.toHaveBeenCalledWith('createLink', false, expect.anything());
  });

  it('does not execute createLink when URL prompt returns empty string', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('');
    const { container } = render(<WysiwygEditor value="<p>text</p>" onChange={vi.fn()} />);

    const linkBtn = Array.from(container.querySelectorAll('button')).find(b => b.title === 'Link');
    fireEvent.click(linkBtn!);

    expect(mockExecCommand).not.toHaveBeenCalledWith('createLink', false, expect.anything());
  });

  it('executes removeFormat command when Clear formatting button is clicked', () => {
    const { container } = render(<WysiwygEditor value="<p>text</p>" onChange={vi.fn()} />);

    const clearBtn = Array.from(container.querySelectorAll('button')).find(b => b.title === 'Clear formatting');
    fireEvent.click(clearBtn!);

    expect(mockExecCommand).toHaveBeenCalledWith('removeFormat', false, undefined);
  });

  it('renders all toolbar buttons', () => {
    const { container } = render(<WysiwygEditor value="" onChange={vi.fn()} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(10);
  });
});
