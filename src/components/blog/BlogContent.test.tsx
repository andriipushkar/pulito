// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

import BlogContent from './BlogContent';

describe('BlogContent', () => {
  it('renders HTML content via dangerouslySetInnerHTML', () => {
    const { container } = render(<BlogContent content="<p>Hello world</p>" />);
    expect(container.querySelector('p')).toHaveTextContent('Hello world');
  });

  it('renders complex HTML with headings', () => {
    const html = '<h2>Title</h2><p>Paragraph</p>';
    const { container } = render(<BlogContent content={html} />);
    expect(container.querySelector('h2')).toHaveTextContent('Title');
    expect(container.querySelector('p')).toHaveTextContent('Paragraph');
  });

  it('applies prose CSS class', () => {
    const { container } = render(<BlogContent content="<p>text</p>" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('prose');
  });

  it('renders empty content without crashing', () => {
    const { container } = render(<BlogContent content="" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders a list', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const { container } = render(<BlogContent content={html} />);
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(2);
  });
});
