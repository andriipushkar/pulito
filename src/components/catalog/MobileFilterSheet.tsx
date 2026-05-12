'use client';

import Modal from '@/components/ui/Modal';
import FilterSidebar, { type BrandOption } from './FilterSidebar';
import type { CategoryListItem } from '@/types/category';

interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryListItem[];
  brands?: BrandOption[];
}

export default function MobileFilterSheet({
  isOpen,
  onClose,
  categories,
  brands = [],
}: MobileFilterSheetProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Фільтри" size="full">
      <div className="p-4">
        <FilterSidebar categories={categories} brands={brands} />
      </div>
    </Modal>
  );
}
