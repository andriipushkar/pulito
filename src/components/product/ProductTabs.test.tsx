// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/utils/sanitize', () => ({ sanitizeHtml: (h: string) => h }));

import ProductTabs from './ProductTabs';

const fullContent = {
  fullDescription: '<p>Full desc</p>',
  shortDescription: null,
  specifications: '<p>Specs here</p>',
  usageInstructions: null,
  videoUrl: null,
  seoTitle: null,
  seoDescription: null,
  isFilled: true,
};

const emptyContent = {
  fullDescription: null,
  shortDescription: null,
  specifications: null,
  usageInstructions: null,
  videoUrl: null,
  seoTitle: null,
  seoDescription: null,
  isFilled: true,
};

function getTabs(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[role="tab"]'));
}

function getTabLabels(container: HTMLElement) {
  return getTabs(container).map(t => t.textContent);
}

describe('ProductTabs', () => {
  it('renders delivery tab always (even with null content)', () => {
    const { container } = render(<ProductTabs content={null} />);
    expect(getTabLabels(container)).toContain('Доставка та оплата');
  });

  it('renders delivery info content', () => {
    const { container } = render(<ProductTabs content={null} />);
    const view = within(container);
    expect(view.getByText('Нова Пошта — 1-3 робочі дні')).toBeInTheDocument();
    expect(view.getByText('Укрпошта — 3-7 робочих днів')).toBeInTheDocument();
    expect(view.getByText('Самовивіз зі складу')).toBeInTheDocument();
  });

  it('renders payment info', () => {
    const { container } = render(<ProductTabs content={null} />);
    const view = within(container);
    expect(view.getByText('Накладений платіж')).toBeInTheDocument();
    expect(view.getByText('Оплата на картку')).toBeInTheDocument();
    expect(view.getByText(/Безготівковий розрахунок/)).toBeInTheDocument();
  });

  it('renders description tab when content has fullDescription', () => {
    const { container } = render(<ProductTabs content={fullContent} />);
    expect(getTabLabels(container)).toContain('Опис');
  });

  it('renders specifications tab when content has specifications', () => {
    const { container } = render(<ProductTabs content={{ ...emptyContent, specifications: '<p>Specs</p>' }} />);
    expect(getTabLabels(container)).toContain('Характеристики');
  });

  it('renders all three tabs when all content provided', () => {
    const { container } = render(<ProductTabs content={fullContent} />);
    const labels = getTabLabels(container);
    expect(labels).toContain('Опис');
    expect(labels).toContain('Характеристики');
    expect(labels).toContain('Доставка та оплата');
  });

  it('first tab is active by default (description if exists)', () => {
    const { container } = render(<ProductTabs content={fullContent} />);
    const tabs = getTabs(container);
    const descTab = tabs.find(t => t.textContent === 'Опис');
    expect(descTab).toHaveAttribute('aria-selected', 'true');
  });

  it('can switch tabs by clicking', () => {
    const { container } = render(<ProductTabs content={fullContent} />);
    const tabs = getTabs(container);
    const deliveryTab = tabs.find(t => t.textContent === 'Доставка та оплата')!;
    fireEvent.click(deliveryTab);
    expect(deliveryTab).toHaveAttribute('aria-selected', 'true');
  });

  it('renders fullDescription HTML content', () => {
    const { container } = render(<ProductTabs content={fullContent} />);
    const view = within(container);
    expect(view.getByText('Full desc')).toBeInTheDocument();
  });

  it('renders specifications HTML content when specs tab first', () => {
    const { container } = render(<ProductTabs content={{ ...emptyContent, specifications: '<p>Spec data</p>' }} />);
    const view = within(container);
    expect(view.getByText('Spec data')).toBeInTheDocument();
  });

  it('does not render description tab when fullDescription is null', () => {
    const { container } = render(<ProductTabs content={emptyContent} />);
    expect(getTabLabels(container)).not.toContain('Опис');
  });

  it('does not render specs tab when specifications is null', () => {
    const { container } = render(<ProductTabs content={emptyContent} />);
    expect(getTabLabels(container)).not.toContain('Характеристики');
  });

  it('renders delivery headings', () => {
    const { container } = render(<ProductTabs content={null} />);
    const view = within(container);
    expect(view.getAllByText('Доставка').length).toBeGreaterThanOrEqual(1);
    expect(view.getAllByText('Оплата').length).toBeGreaterThanOrEqual(1);
  });
});
