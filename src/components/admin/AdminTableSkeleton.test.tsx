// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import AdminTableSkeleton, { AdminStatsSkeleton, AdminFormSkeleton } from './AdminTableSkeleton';

afterEach(() => {
  cleanup();
});

describe('AdminTableSkeleton', () => {
  it('renders default 8 rows and 6 columns', () => {
    const { container } = render(<AdminTableSkeleton />);
    // Header row has 6 skeleton divs
    const headerRow = container.querySelector('.border-b.bg-\\[var\\(--color-bg-secondary\\)\\]');
    expect(headerRow).toBeInTheDocument();
    // 8 body rows + 1 header row = 9 rows with border-b
    const allRows = container.querySelectorAll('.flex.items-center.gap-4');
    expect(allRows).toHaveLength(8);
  });

  it('renders custom number of rows and columns', () => {
    const { container } = render(<AdminTableSkeleton rows={3} columns={4} />);
    const bodyRows = container.querySelectorAll('.flex.items-center.gap-4');
    expect(bodyRows).toHaveLength(3);
    // Each body row should have 4 skeleton children
    const firstRowSkeletons = bodyRows[0]?.children;
    expect(firstRowSkeletons).toHaveLength(4);
  });

  it('first column in body rows has max-w-[200px] class', () => {
    const { container } = render(<AdminTableSkeleton rows={1} columns={3} />);
    const bodyRow = container.querySelector('.flex.items-center.gap-4');
    const firstCol = bodyRow?.children[0];
    expect(firstCol).toHaveClass('max-w-[200px]');
  });
});

describe('AdminStatsSkeleton', () => {
  it('renders default 5 stat cards', () => {
    const { container } = render(<AdminStatsSkeleton />);
    const cards = container.querySelectorAll('.rounded-xl');
    expect(cards).toHaveLength(5);
  });

  it('renders custom count of stat cards', () => {
    const { container } = render(<AdminStatsSkeleton count={3} />);
    const cards = container.querySelectorAll('.rounded-xl');
    expect(cards).toHaveLength(3);
  });
});

describe('AdminFormSkeleton', () => {
  it('renders default 6 form fields', () => {
    const { container } = render(<AdminFormSkeleton />);
    const fields = container.querySelectorAll('.h-10');
    expect(fields).toHaveLength(6);
  });

  it('renders custom field count', () => {
    const { container } = render(<AdminFormSkeleton fields={2} />);
    const fields = container.querySelectorAll('.h-10');
    expect(fields).toHaveLength(2);
  });
});
