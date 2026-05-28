'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder, CharacterCount } from '@tiptap/extensions';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useTranslations } from 'next-intl';

// Refuse to embed any URL whose scheme is not in this allow-list. Tiptap will
// happily store `javascript:` / `data:` / `vbscript:` hrefs — they get stripped
// by DOMPurify at render time *today*, but the dangerous string still lives in
// the saved HTML. Filtering at input time makes the stored HTML safe by design.
const ALLOWED_URL_SCHEMES = /^(https?:|\/|mailto:|tel:|#)/i;
function isSafeEditorUrl(value: string): boolean {
  return ALLOWED_URL_SCHEMES.test(value.trim());
}

interface WysiwygEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  /** Optional hard cap on characters (CharacterCount enforces it). */
  maxLength?: number;
}

const NORMALIZED_EMPTY = '<p></p>';

export default function WysiwygEditor({
  value,
  onChange,
  placeholder,
  className,
  maxLength,
}: WysiwygEditorProps) {
  const t = useTranslations('admin.wysiwygEditor');
  const [fullscreen, setFullscreen] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [sourceValue, setSourceValue] = useState(value || '');
  const [uploading, setUploading] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TableKit.configure({
        table: { resizable: true, HTMLAttributes: { class: 'tiptap-table' } },
      }),
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript,
      TextStyle,
      Color,
      Placeholder.configure({ placeholder: placeholder || t('placeholder') }),
      CharacterCount.configure({ limit: maxLength }),
    ],
    content: value || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose max-w-none min-h-[200px] px-4 py-3 text-sm outline-none focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const normalized = html === NORMALIZED_EMPTY ? '' : html;
      onChange(normalized);
      setSourceValue(normalized);
    },
  });

  // External `value` resets (e.g. form revert) should not jump the cursor.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = value || '';
    if (current === incoming) return;
    if (current === NORMALIZED_EMPTY && incoming === '') return;
    editor.commands.setContent(incoming, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync source-view textarea to external value reset; setContent uses emitUpdate:false so onUpdate won't fire
    setSourceValue(incoming);
  }, [value, editor]);

  // Paste + drop image upload. Listening on the editor's DOM beats configuring
  // editorProps.handlePaste/handleDrop because we need the React closure to
  // resolve the upload promise back into a setImage chain on the editor.
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;

    const uploadFiles = async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith('image/'));
      if (images.length === 0) return;
      setUploading((n) => n + images.length);
      for (const file of images) {
        const url = await uploadImageToServer(file);
        if (url) {
          const alt = promptForAltText(filenameToAlt(file.name), t('altPrompt'), t('imageAlt'));
          if (alt !== null) editor.chain().focus().setImage({ src: url, alt }).run();
        }
        setUploading((n) => n - 1);
      }
    };

    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files || []);
      if (files.some((f) => f.type.startsWith('image/'))) {
        event.preventDefault();
        uploadFiles(files);
      }
    };

    const onDrop = (event: DragEvent) => {
      const files = Array.from(event.dataTransfer?.files || []);
      if (files.some((f) => f.type.startsWith('image/'))) {
        event.preventDefault();
        uploadFiles(files);
      }
    };

    dom.addEventListener('paste', onPaste);
    dom.addEventListener('drop', onDrop);
    return () => {
      dom.removeEventListener('paste', onPaste);
      dom.removeEventListener('drop', onDrop);
    };
  }, [editor, t]);

  const switchToWysiwyg = () => {
    if (editor && sourceValue !== editor.getHTML()) {
      editor.commands.setContent(sourceValue, { emitUpdate: true });
    }
    setShowSource(false);
  };

  const switchToSource = () => {
    if (editor) setSourceValue(editor.getHTML());
    setShowSource(true);
  };

  const onSourceChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setSourceValue(next);
    onChange(next === NORMALIZED_EMPTY ? '' : next);
  };

  // CharacterCount storage is only available once editor is created.
  const cc = editor?.storage.characterCount as
    | { characters: () => number; words: () => number }
    | undefined;
  const characters = cc?.characters() ?? 0;
  const words = cc?.words() ?? 0;
  const overLimit = maxLength != null && characters > maxLength;

  const containerClass = fullscreen
    ? 'fixed inset-0 z-[60] flex flex-col bg-[var(--color-bg)]'
    : `flex flex-col rounded-[var(--radius)] border border-[var(--color-border)] ${className || ''}`;

  return (
    <div className={containerClass}>
      <Toolbar
        editor={editor}
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen((v) => !v)}
        showSource={showSource}
        onToggleSource={() => (showSource ? switchToWysiwyg() : switchToSource())}
      />
      <div className={fullscreen ? 'flex-1 overflow-auto' : ''}>
        {showSource ? (
          <textarea
            value={sourceValue}
            onChange={onSourceChange}
            className="block min-h-[300px] w-full resize-y border-0 p-4 font-mono text-xs outline-none"
            spellCheck={false}
          />
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)]">
        <span className={overLimit ? 'text-[var(--color-danger)]' : undefined}>
          {t('wordsLabel', { count: words })} · {t('charsLabel', { count: characters })}
          {maxLength ? ` / ${maxLength}` : ''}
        </span>
        <span className="hidden gap-3 sm:flex">
          {uploading > 0 && (
            <span className="text-[var(--color-primary)]">
              {t('uploadingImages', { count: uploading })}
            </span>
          )}
          <span>{t('dragHint')}</span>
        </span>
      </div>
    </div>
  );
}

/** Turn a filename like "ваза-керамічна-001.jpg" into a sensible alt default. */
function filenameToAlt(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Block-insertion ask for alt text. Returns trimmed value or null if user
 * cancelled. Empty input falls back to the default so we never insert an
 * image with empty alt — bad for SEO and screen readers. */
function promptForAltText(
  defaultValue: string,
  promptLabel: string,
  fallback: string,
): string | null {
  const answer = window.prompt(promptLabel, defaultValue);
  if (answer === null) return null;
  const trimmed = answer.trim();
  return trimmed || defaultValue || fallback;
}

async function uploadImageToServer(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', 'general');
  try {
    const res = await fetch('/api/v1/admin/upload', {
      method: 'POST',
      body: fd,
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    const data = await res.json();
    if (data?.success && data.data?.path) return data.data.path as string;
  } catch {
    // Caller treats null as "upload failed"; the editor stays as-is.
  }
  return null;
}

interface ToolbarProps {
  editor: Editor | null;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  showSource: boolean;
  onToggleSource: () => void;
}

function Toolbar({
  editor,
  fullscreen,
  onToggleFullscreen,
  showSource,
  onToggleSource,
}: ToolbarProps) {
  const t = useTranslations('admin.wysiwygEditor');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const highlightInputRef = useRef<HTMLInputElement>(null);

  if (!editor) {
    return (
      <div className="h-9 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]" />
    );
  }

  const inTable = editor.isActive('table');
  const sourceOnly = showSource; // source view disables WYSIWYG controls

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-1">
      <Btn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        disabled={sourceOnly}
        title={t('bold')}
      >
        <b>B</b>
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        disabled={sourceOnly}
        title={t('italic')}
      >
        <i>I</i>
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        disabled={sourceOnly}
        title={t('underline')}
      >
        <u>U</u>
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        disabled={sourceOnly}
        title={t('strike')}
      >
        <s>S</s>
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleSubscript().run()}
        active={editor.isActive('subscript')}
        disabled={sourceOnly}
        title={t('subscript')}
      >
        X₂
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
        active={editor.isActive('superscript')}
        disabled={sourceOnly}
        title={t('superscript')}
      >
        X²
      </Btn>

      <Sep />

      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        disabled={sourceOnly}
        title={t('heading2')}
      >
        H2
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        disabled={sourceOnly}
        title={t('heading3')}
      >
        H3
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
        active={editor.isActive('heading', { level: 4 })}
        disabled={sourceOnly}
        title={t('heading4')}
      >
        H4
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().setParagraph().run()}
        active={editor.isActive('paragraph') && !editor.isActive('heading')}
        disabled={sourceOnly}
        title={t('paragraph')}
      >
        P
      </Btn>

      <Sep />

      <Btn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        disabled={sourceOnly}
        title={t('bulletList')}
      >
        •
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        disabled={sourceOnly}
        title={t('orderedList')}
      >
        1.
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        disabled={sourceOnly}
        title={t('blockquote')}
      >
        ❝
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        disabled={sourceOnly}
        title={t('codeBlock')}
      >
        {'</>'}
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        disabled={sourceOnly}
        title={t('horizontalRule')}
      >
        —
      </Btn>

      <Sep />

      <Btn
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        active={editor.isActive({ textAlign: 'left' })}
        disabled={sourceOnly}
        title={t('alignLeft')}
      >
        ⇤
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        active={editor.isActive({ textAlign: 'center' })}
        disabled={sourceOnly}
        title={t('alignCenter')}
      >
        ↔
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        active={editor.isActive({ textAlign: 'right' })}
        disabled={sourceOnly}
        title={t('alignRight')}
      >
        ⇥
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        active={editor.isActive({ textAlign: 'justify' })}
        disabled={sourceOnly}
        title={t('alignJustify')}
      >
        ☰
      </Btn>

      <Sep />

      <label
        className="relative flex h-6 min-w-[28px] cursor-pointer items-center justify-center rounded px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
        title={t('textColor')}
      >
        A<span className="text-[10px] leading-none">▾</span>
        <input
          ref={colorInputRef}
          type="color"
          aria-label={t('textColor')}
          disabled={sourceOnly}
          onInput={(e) =>
            editor
              .chain()
              .focus()
              .setColor((e.target as HTMLInputElement).value)
              .run()
          }
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <Btn
        onClick={() => editor.chain().focus().unsetColor().run()}
        disabled={sourceOnly}
        title={t('resetColor')}
      >
        A✕
      </Btn>
      <label
        className="relative flex h-6 min-w-[28px] cursor-pointer items-center justify-center rounded px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
        title={t('highlightColor')}
      >
        <span className="rounded px-1" style={{ backgroundColor: '#fde68a' }}>
          H
        </span>
        <input
          ref={highlightInputRef}
          type="color"
          aria-label={t('highlightColor')}
          disabled={sourceOnly}
          onInput={(e) =>
            editor
              .chain()
              .focus()
              .toggleHighlight({ color: (e.target as HTMLInputElement).value })
              .run()
          }
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <Btn
        onClick={() => editor.chain().focus().unsetHighlight().run()}
        disabled={sourceOnly}
        title={t('removeHighlight')}
      >
        H✕
      </Btn>

      <Sep />

      <Btn
        onClick={() => {
          const previous = editor.getAttributes('link').href as string | undefined;
          const url = window.prompt(t('linkPrompt'), previous ?? '');
          if (url === null) return;
          if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
          }
          if (!isSafeEditorUrl(url)) {
            window.alert(t('linkSchemeAlert'));
            return;
          }
          editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
        }}
        active={editor.isActive('link')}
        disabled={sourceOnly}
        title={t('link')}
      >
        🔗
      </Btn>
      <Btn
        onClick={() => fileInputRef.current?.click()}
        disabled={sourceOnly}
        title={t('uploadImage')}
      >
        🖼
      </Btn>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            const url = await uploadImageToServer(file);
            if (url) {
              const alt = promptForAltText(filenameToAlt(file.name), t('altPrompt'), t('imageAlt'));
              if (alt !== null) editor.chain().focus().setImage({ src: url, alt }).run();
            }
          }
          e.target.value = '';
        }}
      />
      <Btn
        onClick={() => {
          const url = window.prompt(t('imageUrlPrompt'));
          if (!url) return;
          if (!isSafeEditorUrl(url)) {
            window.alert(t('imageSchemeAlert'));
            return;
          }
          const alt = promptForAltText(
            filenameToAlt(url.split('/').pop() || ''),
            t('altPrompt'),
            t('imageAlt'),
          );
          if (alt !== null) editor.chain().focus().setImage({ src: url.trim(), alt }).run();
        }}
        disabled={sourceOnly}
        title={t('imageByUrl')}
      >
        🔗🖼
      </Btn>
      <Btn
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
        disabled={sourceOnly}
        title={t('insertTable')}
      >
        ⊞
      </Btn>

      {inTable && !sourceOnly && (
        <>
          <Sep />
          <Btn
            onClick={() => editor.chain().focus().addRowBefore().run()}
            title={t('addRowBefore')}
          >
            ↑+
          </Btn>
          <Btn onClick={() => editor.chain().focus().addRowAfter().run()} title={t('addRowAfter')}>
            ↓+
          </Btn>
          <Btn onClick={() => editor.chain().focus().deleteRow().run()} title={t('deleteRow')}>
            ↕−
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            title={t('addColumnBefore')}
          >
            ←+
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            title={t('addColumnAfter')}
          >
            +→
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().deleteColumn().run()}
            title={t('deleteColumn')}
          >
            ↔−
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
            title={t('toggleHeaderRow')}
          >
            TH
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().mergeOrSplit().run()}
            title={t('mergeOrSplit')}
          >
            ⊟
          </Btn>
          <Btn onClick={() => editor.chain().focus().deleteTable().run()} title={t('deleteTable')}>
            ✕⊞
          </Btn>
        </>
      )}

      <Sep />

      <Btn
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        disabled={sourceOnly}
        title={t('clearFormat')}
      >
        ✕
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().undo().run()}
        disabled={sourceOnly || !editor.can().undo()}
        title={t('undo')}
      >
        ↶
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().redo().run()}
        disabled={sourceOnly || !editor.can().redo()}
        title={t('redo')}
      >
        ↷
      </Btn>

      {/* Right-aligned utility buttons */}
      <span className="ml-auto flex items-center gap-1">
        <Btn
          onClick={onToggleSource}
          active={showSource}
          title={showSource ? t('backToVisual') : t('showHtml')}
        >
          {showSource ? '👁' : '<>'}
        </Btn>
        <Btn
          onClick={onToggleFullscreen}
          active={fullscreen}
          title={fullscreen ? t('exitFullscreen') : t('fullscreen')}
        >
          {fullscreen ? '⤢' : '⛶'}
        </Btn>
      </span>
    </div>
  );
}

function Btn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`min-w-[28px] rounded px-2 py-0.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-[var(--color-primary)] text-white'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-1 h-5 self-center border-r border-[var(--color-border)]" />;
}
