'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface ProductImage {
  id: number;
  pathMedium: string;
  sortOrder: number;
}

interface Props {
  productId: number | string;
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
  isUploading: boolean;
  onUpload: (files: FileList) => Promise<void>;
  onRequestDelete: (imageId: number) => void;
}

function SortableImage({
  img,
  onDelete,
  onPreview,
}: {
  img: ProductImage;
  onDelete: () => void;
  onPreview: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: img.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative h-24 w-24 overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-white"
    >
      <button
        type="button"
        onClick={onPreview}
        className="absolute inset-0 z-10"
        aria-label="Збільшити фото"
      >
        <Image
          src={img.pathMedium}
          alt=""
          fill
          sizes="96px"
          className="object-contain p-1"
        />
      </button>
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1 z-20 cursor-grab rounded bg-white/90 px-1 py-0.5 text-[10px] text-[var(--color-text-secondary)] shadow-sm opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        aria-label="Перетягнути"
      >
        ⋮⋮
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="absolute right-1 top-1 z-20 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
      >
        ✕
      </button>
    </div>
  );
}

export default function ProductImagesManager({
  productId,
  images,
  onChange,
  isUploading,
  onUpload,
  onRequestDelete,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const persistOrder = useCallback(
    async (next: ProductImage[]) => {
      const res = await apiClient.patch(`/api/v1/admin/products/${productId}/images/reorder`, {
        imageIds: next.map((i) => i.id),
      });
      if (!res.success) {
        toast.error(res.error || 'Не вдалося зберегти порядок');
      }
    },
    [productId],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = images.findIndex((i) => i.id === active.id);
    const newIndex = images.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(images, oldIndex, newIndex);
    onChange(next);
    persistOrder(next);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast.error('Можна перетягувати тільки зображення');
      return;
    }
    const dt = new DataTransfer();
    imageFiles.forEach((f) => dt.items.add(f));
    await onUpload(dt.files);
  };

  return (
    <div>
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragging) setDragging(true);
        }}
        onDragLeave={(e) => {
          // Only unset if we're truly leaving the drop area
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragging(false);
        }}
        onDrop={handleDrop}
        className={`relative rounded-[var(--radius)] border-2 border-dashed p-3 transition-colors ${
          dragging
            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
            : 'border-transparent'
        }`}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="flex flex-wrap gap-3">
              {images.map((img) => (
                <SortableImage
                  key={img.id}
                  img={img}
                  onDelete={() => onRequestDelete(img.id)}
                  onPreview={() => setPreview(img.pathMedium)}
                />
              ))}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className={`flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-[var(--radius)] border-2 border-dashed border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] ${
                  isUploading ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                <span className="text-2xl">{isUploading ? '⏳' : '+'}</span>
                <span className="px-1 text-center text-[10px] leading-tight">
                  {isUploading ? 'Завантаження' : 'Додати або перетягни'}
                </span>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  if (e.target.files) onUpload(e.target.files);
                  e.target.value = '';
                }}
                className="hidden"
                disabled={isUploading}
              />
            </div>
          </SortableContext>
        </DndContext>
        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[var(--radius)] bg-[var(--color-primary)]/10">
            <span className="rounded bg-[var(--color-primary)] px-3 py-1 text-sm font-semibold text-white">
              Відпустіть, щоб завантажити
            </span>
          </div>
        )}
      </div>
      {images.length > 1 && (
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
          Перетягуйте зображення, щоб змінити порядок. Перше — головне.
        </p>
      )}
      {preview && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Перегляд фото"
        >
          <div className="relative max-h-full max-w-3xl">
            <Image
              src={preview}
              alt=""
              width={1200}
              height={1200}
              className="max-h-[85vh] w-auto object-contain"
              unoptimized
            />
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg shadow-lg hover:bg-gray-100"
              aria-label="Закрити"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
