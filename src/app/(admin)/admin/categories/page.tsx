'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface AdminCategory {
  id: number;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  parentId: number | null;
  _count?: { products: number; children: number };
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', slug: '', sortOrder: 0, isActive: true });
  const [isSaving, setIsSaving] = useState(false);
  const [mergeSource, setMergeSource] = useState<number | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string>('');
  const [isMerging, setIsMerging] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', slug: '', parentId: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'merge' | 'delete'; id?: number; name?: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadCategories = useCallback(() => {
    setIsLoading(true);
    apiClient
      .get<AdminCategory[]>('/api/v1/admin/categories')
      .then((res) => { if (res.success && res.data) setCategories(res.data); })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const rootCategories = categories.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
  const childrenOf = (parentId: number) => categories.filter((c) => c.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder);

  const handleEdit = (cat: AdminCategory) => {
    setEditingId(cat.id);
    setEditForm({ name: cat.name, slug: cat.slug, sortOrder: cat.sortOrder, isActive: cat.isActive });
  };

  const handleSave = async () => {
    if (!editingId) return;
    setIsSaving(true);
    try {
      const res = await apiClient.put(`/api/v1/admin/categories/${editingId}`, editForm);
      if (res.success) {
        setEditingId(null);
        loadCategories();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = Number(active.id);
    const overId = Number(over.id);
    const activeCat = categories.find((c) => c.id === activeId);
    const overCat = categories.find((c) => c.id === overId);
    if (!activeCat || !overCat) return;

    // Only allow reorder within same parent
    if (activeCat.parentId !== overCat.parentId) return;

    const siblings = activeCat.parentId ? childrenOf(activeCat.parentId) : rootCategories;
    const oldIndex = siblings.findIndex((c) => c.id === activeId);
    const newIndex = siblings.findIndex((c) => c.id === overId);
    const reordered = arrayMove(siblings, oldIndex, newIndex);

    // Optimistic update
    const newCategories = categories.map((c) => {
      const idx = reordered.findIndex((r) => r.id === c.id);
      if (idx !== -1) return { ...c, sortOrder: idx };
      return c;
    });
    setCategories(newCategories);

    // Save to server
    await Promise.all(
      reordered.map((cat, idx) =>
        apiClient.put(`/api/v1/admin/categories/${cat.id}`, { sortOrder: idx })
      )
    );
  };

  const handleMerge = () => {
    if (!mergeSource || !mergeTarget) return;
    const targetId = Number(mergeTarget);
    if (mergeSource === targetId) return;
    setConfirmAction({ type: 'merge' });
  };

  const executeMerge = async () => {
    if (!mergeSource || !mergeTarget) return;
    const targetId = Number(mergeTarget);
    setConfirmAction(null);
    setIsMerging(true);
    try {
      const res = await apiClient.post(`/api/v1/admin/categories/${mergeSource}/merge`, { targetCategoryId: targetId });
      if (res.success) {
        setMergeSource(null);
        setMergeTarget('');
        loadCategories();
      }
    } finally {
      setIsMerging(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) return;
    setIsCreating(true);
    try {
      const slug = createForm.slug.trim() || createForm.name.trim().toLowerCase().replace(/[^a-zа-яіїєґ0-9]+/gi, '-').replace(/-+$/, '');
      const payload: Record<string, unknown> = { name: createForm.name.trim(), slug };
      if (createForm.parentId) payload.parentId = Number(createForm.parentId);
      const res = await apiClient.post('/api/v1/admin/categories', payload);
      if (res.success) {
        setShowCreate(false);
        setCreateForm({ name: '', slug: '', parentId: '' });
        loadCategories();
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = (catId: number) => {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    setConfirmAction({ type: 'delete', id: catId, name: cat.name });
  };

  const executeDelete = async () => {
    if (!confirmAction || confirmAction.type !== 'delete' || !confirmAction.id) return;
    const catId = confirmAction.id;
    setConfirmAction(null);
    setIsDeleting(catId);
    try {
      const res = await apiClient.delete(`/api/v1/admin/categories/${catId}`);
      if (res.success) loadCategories();
    } finally {
      setIsDeleting(null);
    }
  };

  const handleToggle = async (cat: AdminCategory) => {
    await apiClient.put(`/api/v1/admin/categories/${cat.id}`, { isActive: !cat.isActive });
    loadCategories();
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Категорії</h2>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Скасувати' : '+ Створити категорію'}
        </Button>
      </div>

      {showCreate && (
        <div className="mb-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="mb-3 text-sm font-semibold">Нова категорія</p>
          <div className="flex flex-wrap gap-3">
            <Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Назва категорії" className="w-56" />
            <Input value={createForm.slug} onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })} placeholder="Slug (автоматично)" className="w-44" />
            <select
              value={createForm.parentId}
              onChange={(e) => setCreateForm({ ...createForm, parentId: e.target.value })}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
            >
              <option value="">Без батьківської</option>
              {rootCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Button onClick={handleCreate} isLoading={isCreating}>Створити</Button>
          </div>
        </div>
      )}

      {mergeSource && (
        <div className="mb-4 rounded-[var(--radius)] border border-yellow-300 bg-yellow-50 p-4">
          <p className="mb-2 text-sm font-medium">
            Об&apos;єднати &quot;{categories.find((c) => c.id === mergeSource)?.name}&quot; в:
          </p>
          <div className="flex gap-2">
            <select
              value={mergeTarget}
              onChange={(e) => setMergeTarget(e.target.value)}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm"
            >
              <option value="">Оберіть категорію</option>
              {categories.filter((c) => c.id !== mergeSource).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Button size="sm" onClick={handleMerge} isLoading={isMerging} disabled={!mergeTarget}>Об&apos;єднати</Button>
            <Button size="sm" variant="outline" onClick={() => { setMergeSource(null); setMergeTarget(''); }}>Скасувати</Button>
          </div>
        </div>
      )}

      <p className="mb-2 text-xs text-[var(--color-text-secondary)]">Перетягуйте категорії для зміни порядку</p>

      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rootCategories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {rootCategories.map((cat, i) => (
              <div key={cat.id}>
                <SortableCategoryRow
                  cat={cat}
                  isEditing={editingId === cat.id}
                  editForm={editForm}
                  isSaving={isSaving}
                  onEdit={() => handleEdit(cat)}
                  onSave={handleSave}
                  onCancel={() => setEditingId(null)}
                  onEditFormChange={setEditForm}
                  onToggle={() => handleToggle(cat)}
                  onMerge={() => setMergeSource(cat.id)}
                  onDelete={() => handleDelete(cat.id)}
                  isDeleting={isDeleting === cat.id}
                  isFirst={i === 0}
                />
                {childrenOf(cat.id).length > 0 && (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={childrenOf(cat.id).map((c) => c.id)} strategy={verticalListSortingStrategy}>
                      {childrenOf(cat.id).map((child) => (
                        <SortableCategoryRow
                          key={child.id}
                          cat={child}
                          isEditing={editingId === child.id}
                          editForm={editForm}
                          isSaving={isSaving}
                          onEdit={() => handleEdit(child)}
                          onSave={handleSave}
                          onCancel={() => setEditingId(null)}
                          onEditFormChange={setEditForm}
                          onToggle={() => handleToggle(child)}
                          onMerge={() => setMergeSource(child.id)}
                          onDelete={() => handleDelete(child.id)}
                          isDeleting={isDeleting === child.id}
                          isChild
                          isFirst={false}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            ))}
          </SortableContext>
        </DndContext>
        {categories.length === 0 && (
          <div className="px-4 py-8 text-center text-[var(--color-text-secondary)]">Категорій немає</div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmAction?.type === 'merge'}
        onClose={() => setConfirmAction(null)}
        onConfirm={executeMerge}
        title="Об'єднання категорій"
        message="Об'єднати категорію в іншу? Всі товари будуть переміщені."
        confirmText="Об'єднати"
        variant="warning"
      />

      <ConfirmDialog
        isOpen={confirmAction?.type === 'delete'}
        onClose={() => setConfirmAction(null)}
        onConfirm={executeDelete}
        title="Видалення категорії"
        message={`Видалити категорію "${confirmAction?.name ?? ''}"? Товари залишаться без категорії.`}
        confirmText="Видалити"
        variant="danger"
      />
    </div>
  );
}

function SortableCategoryRow({
  cat,
  isEditing,
  editForm,
  isSaving,
  onEdit,
  onSave,
  onCancel,
  onEditFormChange,
  onToggle,
  onMerge,
  onDelete,
  isDeleting,
  isChild,
  isFirst,
}: {
  cat: AdminCategory;
  isEditing: boolean;
  editForm: { name: string; slug: string; sortOrder: number; isActive: boolean };
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onEditFormChange: (form: { name: string; slug: string; sortOrder: number; isActive: boolean }) => void;
  onToggle: () => void;
  onMerge: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  isChild?: boolean;
  isFirst?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  if (isEditing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 ${isChild ? 'pl-10' : ''}`}
      >
        <div className="flex flex-wrap gap-3">
          <Input value={editForm.name} onChange={(e) => onEditFormChange({ ...editForm, name: e.target.value })} placeholder="Назва" className="w-48" />
          <Input value={editForm.slug} onChange={(e) => onEditFormChange({ ...editForm, slug: e.target.value })} placeholder="Slug" className="w-40" />
          <Input type="number" value={String(editForm.sortOrder)} onChange={(e) => onEditFormChange({ ...editForm, sortOrder: Number(e.target.value) })} placeholder="Порядок" className="w-24" />
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={editForm.isActive} onChange={(e) => onEditFormChange({ ...editForm, isActive: e.target.checked })} className="accent-[var(--color-primary)]" />
            Активна
          </label>
          <Button size="sm" onClick={onSave} isLoading={isSaving}>Зберегти</Button>
          <Button size="sm" variant="outline" onClick={onCancel}>Скасувати</Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between px-4 py-3 ${!isFirst ? 'border-t border-[var(--color-border)]' : ''} ${isChild ? 'pl-10' : ''}`}
    >
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] active:cursor-grabbing"
          aria-label={`Перетягнути ${cat.name}`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
          </svg>
        </button>
        <div>
          <span className={`font-medium ${isChild ? 'text-sm' : ''}`}>{cat.name}</span>
          <span className="ml-2 text-xs text-[var(--color-text-secondary)]">/{cat.slug}</span>
          {cat._count?.products !== undefined && (
            <span className="ml-2 text-xs text-[var(--color-text-secondary)]">({cat._count.products} товарів)</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onToggle} className={`rounded-full px-2 py-0.5 text-xs font-medium ${cat.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
          {cat.isActive ? 'Активна' : 'Вимкнена'}
        </button>
        <button onClick={onEdit} className="text-xs text-[var(--color-primary)] hover:underline">Редагувати</button>
        <button onClick={onMerge} className="text-xs text-[var(--color-text-secondary)] hover:underline">Об&apos;єднати</button>
        <button onClick={onDelete} disabled={isDeleting} className="text-xs text-[var(--color-danger)] hover:underline disabled:opacity-50">
          {isDeleting ? '...' : 'Видалити'}
        </button>
      </div>
    </div>
  );
}
