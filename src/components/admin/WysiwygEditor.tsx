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
import { plural } from '@/utils/format';

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
      Placeholder.configure({ placeholder: placeholder || 'Введіть текст...' }),
      CharacterCount.configure({ limit: maxLength }),
    ],
    content: value || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose max-w-none min-h-[200px] px-4 py-3 text-sm outline-none focus:outline-none',
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
        if (url) editor.chain().focus().setImage({ src: url }).run();
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
  }, [editor]);

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
          {words} {plural(words, ['слово', 'слова', 'слів'])} · {characters}{' '}
          {plural(characters, ['символ', 'символи', 'символів'])}
          {maxLength ? ` / ${maxLength}` : ''}
        </span>
        <span className="hidden gap-3 sm:flex">
          {uploading > 0 && (
            <span className="text-[var(--color-primary)]">
              Завантаження зображень: {uploading}…
            </span>
          )}
          <span>Підказка: можна вставляти й перетягувати зображення</span>
        </span>
      </div>
    </div>
  );
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
        title="Жирний (Ctrl+B)"
      >
        <b>B</b>
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        disabled={sourceOnly}
        title="Курсив (Ctrl+I)"
      >
        <i>I</i>
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        disabled={sourceOnly}
        title="Підкреслений (Ctrl+U)"
      >
        <u>U</u>
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        disabled={sourceOnly}
        title="Закреслений"
      >
        <s>S</s>
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleSubscript().run()}
        active={editor.isActive('subscript')}
        disabled={sourceOnly}
        title="Нижній індекс (H₂O)"
      >
        X₂
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
        active={editor.isActive('superscript')}
        disabled={sourceOnly}
        title="Верхній індекс (м²)"
      >
        X²
      </Btn>

      <Sep />

      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        disabled={sourceOnly}
        title="Заголовок 2"
      >
        H2
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        disabled={sourceOnly}
        title="Заголовок 3"
      >
        H3
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
        active={editor.isActive('heading', { level: 4 })}
        disabled={sourceOnly}
        title="Заголовок 4"
      >
        H4
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().setParagraph().run()}
        active={editor.isActive('paragraph') && !editor.isActive('heading')}
        disabled={sourceOnly}
        title="Абзац"
      >
        P
      </Btn>

      <Sep />

      <Btn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        disabled={sourceOnly}
        title="Маркований список"
      >
        •
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        disabled={sourceOnly}
        title="Нумерований список"
      >
        1.
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        disabled={sourceOnly}
        title="Цитата"
      >
        ❝
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        disabled={sourceOnly}
        title="Блок коду"
      >
        {'</>'}
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        disabled={sourceOnly}
        title="Розділювач (горизонтальна лінія)"
      >
        —
      </Btn>

      <Sep />

      <Btn
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        active={editor.isActive({ textAlign: 'left' })}
        disabled={sourceOnly}
        title="Вирівняти ліворуч"
      >
        ⇤
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        active={editor.isActive({ textAlign: 'center' })}
        disabled={sourceOnly}
        title="Центрувати"
      >
        ↔
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        active={editor.isActive({ textAlign: 'right' })}
        disabled={sourceOnly}
        title="Вирівняти праворуч"
      >
        ⇥
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        active={editor.isActive({ textAlign: 'justify' })}
        disabled={sourceOnly}
        title="По ширині"
      >
        ☰
      </Btn>

      <Sep />

      <label
        className="relative flex h-6 min-w-[28px] cursor-pointer items-center justify-center rounded px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
        title="Колір тексту"
      >
        A<span className="text-[10px] leading-none">▾</span>
        <input
          ref={colorInputRef}
          type="color"
          aria-label="Колір тексту"
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
        title="Скинути колір тексту"
      >
        A✕
      </Btn>
      <label
        className="relative flex h-6 min-w-[28px] cursor-pointer items-center justify-center rounded px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
        title="Колір підсвітки"
      >
        <span className="rounded px-1" style={{ backgroundColor: '#fde68a' }}>
          H
        </span>
        <input
          ref={highlightInputRef}
          type="color"
          aria-label="Колір підсвітки"
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
        title="Зняти підсвітку"
      >
        H✕
      </Btn>

      <Sep />

      <Btn
        onClick={() => {
          const previous = editor.getAttributes('link').href as string | undefined;
          const url = window.prompt('URL посилання (порожньо — видалити):', previous ?? '');
          if (url === null) return;
          if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
          }
          editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        }}
        active={editor.isActive('link')}
        disabled={sourceOnly}
        title="Посилання"
      >
        🔗
      </Btn>
      <Btn
        onClick={() => fileInputRef.current?.click()}
        disabled={sourceOnly}
        title="Завантажити зображення з ПК"
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
            if (url) editor.chain().focus().setImage({ src: url }).run();
          }
          e.target.value = '';
        }}
      />
      <Btn
        onClick={() => {
          const url = window.prompt('URL зображення:');
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }}
        disabled={sourceOnly}
        title="Зображення за URL"
      >
        🔗🖼
      </Btn>
      <Btn
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
        disabled={sourceOnly}
        title="Вставити таблицю 3×3"
      >
        ⊞
      </Btn>

      {inTable && !sourceOnly && (
        <>
          <Sep />
          <Btn onClick={() => editor.chain().focus().addRowBefore().run()} title="Додати рядок вище">
            ↑+
          </Btn>
          <Btn onClick={() => editor.chain().focus().addRowAfter().run()} title="Додати рядок нижче">
            ↓+
          </Btn>
          <Btn onClick={() => editor.chain().focus().deleteRow().run()} title="Видалити рядок">
            ↕−
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            title="Додати стовпець ліворуч"
          >
            ←+
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            title="Додати стовпець праворуч"
          >
            +→
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().deleteColumn().run()}
            title="Видалити стовпець"
          >
            ↔−
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
            title="Перемкнути заголовок рядка"
          >
            TH
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().mergeOrSplit().run()}
            title="Об'єднати / розділити комірки"
          >
            ⊟
          </Btn>
          <Btn onClick={() => editor.chain().focus().deleteTable().run()} title="Видалити таблицю">
            ✕⊞
          </Btn>
        </>
      )}

      <Sep />

      <Btn
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        disabled={sourceOnly}
        title="Скинути форматування"
      >
        ✕
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().undo().run()}
        disabled={sourceOnly || !editor.can().undo()}
        title="Відмінити (Ctrl+Z)"
      >
        ↶
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().redo().run()}
        disabled={sourceOnly || !editor.can().redo()}
        title="Повторити (Ctrl+Shift+Z)"
      >
        ↷
      </Btn>

      {/* Right-aligned utility buttons */}
      <span className="ml-auto flex items-center gap-1">
        <Btn
          onClick={onToggleSource}
          active={showSource}
          title={showSource ? 'Назад у візуальний редактор' : 'Показати HTML'}
        >
          {showSource ? '👁' : '<>'}
        </Btn>
        <Btn
          onClick={onToggleFullscreen}
          active={fullscreen}
          title={fullscreen ? 'Вийти з повноекранного режиму' : 'На весь екран'}
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
