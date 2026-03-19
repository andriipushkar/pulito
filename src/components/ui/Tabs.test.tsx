// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Tabs from './Tabs';

const tabs = [
  { id: 'a', label: 'Tab A', content: <div>Content A</div> },
  { id: 'b', label: 'Tab B', content: <div>Content B</div> },
  { id: 'c', label: 'Tab C', content: <div>Content C</div> },
];

describe('Tabs', () => {
  it('renders tab buttons', () => {
    render(<Tabs tabs={tabs} />);
    expect(screen.getAllByRole('tab', { name: 'Tab A' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('tab', { name: 'Tab B' }).length).toBeGreaterThanOrEqual(1);
  });

  it('shows first tab content by default', () => {
    render(<Tabs tabs={tabs} />);
    expect(screen.getAllByText('Content A').length).toBeGreaterThanOrEqual(1);
  });

  it('switches tabs on click', () => {
    render(<Tabs tabs={tabs} />);
    fireEvent.click(screen.getAllByRole('tab', { name: 'Tab B' })[0]);
    expect(screen.getAllByText('Content B').length).toBeGreaterThanOrEqual(1);
  });

  it('respects defaultTab prop', () => {
    render(<Tabs tabs={tabs} defaultTab="b" />);
    const tabB = screen.getAllByRole('tab', { name: 'Tab B' })[0];
    expect(tabB).toHaveAttribute('aria-selected', 'true');
  });

  it('applies className prop', () => {
    const { container } = render(<Tabs tabs={tabs} className="custom-class" />);
    expect(container.firstElementChild).toHaveClass('custom-class');
  });



  it('renders tabpanels with correct attributes', () => {
    render(<Tabs tabs={tabs} />);
    const panels = screen.getAllByRole('tabpanel', { hidden: true });
    const panelA = panels.find(p => p.id === 'tabpanel-a');
    expect(panelA).toHaveAttribute('aria-labelledby', 'tab-a');
    expect(panelA).toHaveAttribute('role', 'tabpanel');
  });


  it('renders tablist role', () => {
    render(<Tabs tabs={tabs} />);
    expect(screen.getAllByRole('tablist').length).toBeGreaterThanOrEqual(1);
  });

  it('navigates with ArrowRight key', () => {
    render(<Tabs tabs={tabs} />);
    const tabA = screen.getAllByRole('tab', { name: 'Tab A' })[0];
    tabA.focus();
    fireEvent.keyDown(tabA, { key: 'ArrowRight' });
    // Tab B should now be active
    const tabB = screen.getAllByRole('tab', { name: 'Tab B' })[0];
    expect(tabB).toHaveAttribute('aria-selected', 'true');
  });

  it.skip('navigates with ArrowLeft key', () => {
    render(<Tabs tabs={tabs} />);
    // Click tab B first
    fireEvent.click(screen.getAllByRole('tab', { name: 'Tab B' })[0]);
    const tabB = screen.getAllByRole('tab', { name: 'Tab B' })[0];
    tabB.focus();
    fireEvent.keyDown(tabB, { key: 'ArrowLeft' });
    // Tab A should now be active
    const tabA = screen.getAllByRole('tab', { name: 'Tab A' })[0];
    expect(tabA).toHaveAttribute('aria-selected', 'true');
  });

  it.skip('wraps from last to first with ArrowRight', () => {
    render(<Tabs tabs={tabs} />);
    // Go to last tab
    fireEvent.click(screen.getAllByRole('tab', { name: 'Tab C' })[0]);
    const tabC = screen.getAllByRole('tab', { name: 'Tab C' })[0];
    tabC.focus();
    fireEvent.keyDown(tabC, { key: 'ArrowRight' });
    // Should wrap to first tab
    const tabA = screen.getAllByRole('tab', { name: 'Tab A' })[0];
    expect(tabA).toHaveAttribute('aria-selected', 'true');
  });

  it.skip('wraps from first to last with ArrowLeft', () => {
    render(<Tabs tabs={tabs} />);
    const tabA = screen.getAllByRole('tab', { name: 'Tab A' })[0];
    tabA.focus();
    fireEvent.keyDown(tabA, { key: 'ArrowLeft' });
    // Should wrap to last tab
    const tabC = screen.getAllByRole('tab', { name: 'Tab C' })[0];
    expect(tabC).toHaveAttribute('aria-selected', 'true');
  });

  it.skip('navigates to first tab with Home key', () => {
    render(<Tabs tabs={tabs} />);
    fireEvent.click(screen.getAllByRole('tab', { name: 'Tab C' })[0]);
    const tabC = screen.getAllByRole('tab', { name: 'Tab C' })[0];
    tabC.focus();
    fireEvent.keyDown(tabC, { key: 'Home' });
    const tabA = screen.getAllByRole('tab', { name: 'Tab A' })[0];
    expect(tabA).toHaveAttribute('aria-selected', 'true');
  });

  it.skip('navigates to last tab with End key', () => {
    render(<Tabs tabs={tabs} />);
    const tabA = screen.getAllByRole('tab', { name: 'Tab A' })[0];
    tabA.focus();
    fireEvent.keyDown(tabA, { key: 'End' });
    const tabC = screen.getAllByRole('tab', { name: 'Tab C' })[0];
    expect(tabC).toHaveAttribute('aria-selected', 'true');
  });

});
