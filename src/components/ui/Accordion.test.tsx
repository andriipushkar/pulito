// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Accordion, { AccordionItem } from './Accordion';

describe('Accordion', () => {
  it('renders children', () => {
    render(<Accordion><div>Content</div></Accordion>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});

describe('AccordionItem', () => {
  it('renders title', () => {
    render(<AccordionItem title="Question">Answer</AccordionItem>);
    expect(screen.getByText('Question')).toBeInTheDocument();
  });

  it('toggles on click', () => {
    render(<AccordionItem title="Q1">A1</AccordionItem>);
    const btn = screen.getAllByRole('button')[0];
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });
});
