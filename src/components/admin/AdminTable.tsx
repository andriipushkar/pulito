'use client';

import { Fragment, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import PageSizeSelector from '@/components/admin/PageSizeSelector';

export interface AdminTableColumn<T> {
  key: string;
  header: ReactNode;
  /** Right-aligns numeric columns; defaults to "left". */
  align?: 'left' | 'right' | 'center';
  /** Indicates this column is sortable; set `sortKey` to the API sort param. */
  sortKey?: string;
  /** Render the cell. Receives the row and index for stable refs. */
  render: (row: T, index: number) => ReactNode;
  /** Optional className for the <td>. */
  className?: string;
  /** Hide on very small screens (uses Tailwind `hidden sm:table-cell`). */
  hideOnMobile?: boolean;
}

export interface AdminTableSort {
  by: string;
  dir: 'asc' | 'desc';
}

export interface AdminTablePagination {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
}

export interface AdminTableProps<T> {
  columns: AdminTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  isLoading?: boolean;
  emptyState?: ReactNode;
  sort?: AdminTableSort;
  onSortChange?: (sort: AdminTableSort) => void;
  pagination?: AdminTablePagination;
  /** Optional row click handler. */
  onRowClick?: (row: T) => void;
}

/**
 * Unified admin table with built-in sort headers, pagination footer and
 * loading / empty states. New admin pages should use this; legacy pages can
 * migrate to it incrementally — there is no project-wide breaking switch.
 */
export default function AdminTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  emptyState,
  sort,
  onSortChange,
  pagination,
  onRowClick,
}: AdminTableProps<T>) {
  const t = useTranslations('admin.adminTable');
  const handleHeaderClick = (col: AdminTableColumn<T>) => {
    if (!col.sortKey || !onSortChange) return;
    if (sort?.by === col.sortKey) {
      onSortChange({ by: col.sortKey, dir: sort.dir === 'asc' ? 'desc' : 'asc' });
    } else {
      onSortChange({ by: col.sortKey, dir: 'asc' });
    }
  };

  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.limit)) : 1;

  return (
    <Fragment>
      <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg-secondary)]">
            <tr>
              {columns.map((col) => {
                const sortable = !!col.sortKey && !!onSortChange;
                const active = sort?.by === col.sortKey;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={`px-4 py-2 text-${col.align ?? 'left'} font-medium ${
                      col.hideOnMobile ? 'hidden sm:table-cell' : ''
                    } ${sortable ? 'cursor-pointer select-none' : ''}`}
                    onClick={sortable ? () => handleHeaderClick(col) : undefined}
                    aria-sort={
                      active ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {sortable && (
                        <span
                          className={`text-[10px] ${active ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]/50'}`}
                          aria-hidden="true"
                        >
                          {active ? (sort?.dir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center">
                  <Spinner size="md" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-[var(--color-text-secondary)]"
                >
                  {emptyState ?? t('emptyDefault')}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const key = rowKey(row);
                return (
                  <tr
                    key={key}
                    className={`border-t border-[var(--color-border)] ${
                      onRowClick ? 'cursor-pointer hover:bg-[var(--color-bg-secondary)]/60' : ''
                    }`}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-2 text-${col.align ?? 'left'} ${
                          col.hideOnMobile ? 'hidden sm:table-cell' : ''
                        } ${col.className ?? ''}`}
                      >
                        {col.render(row, idx)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {pagination.onLimitChange ? (
            <PageSizeSelector value={pagination.limit} onChange={pagination.onLimitChange} />
          ) : (
            <span className="text-xs text-[var(--color-text-secondary)]">
              {t('total', { total: pagination.total })}
            </span>
          )}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => pagination.onPageChange(pagination.page - 1)}
              >
                {t('prev')}
              </Button>
              <span className="text-sm text-[var(--color-text-secondary)]">
                {t('pageOf', { page: pagination.page, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= totalPages}
                onClick={() => pagination.onPageChange(pagination.page + 1)}
              >
                {t('next')}
              </Button>
            </div>
          )}
        </div>
      )}
    </Fragment>
  );
}
