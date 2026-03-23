// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

import BlogJsonLd from './BlogJsonLd';

const defaultProps = {
  title: 'Test Article',
  description: 'A test description',
  url: 'https://poroshok.ua/blog/test-article',
  datePublished: '2025-06-01T10:00:00Z',
  dateModified: '2025-06-02T10:00:00Z',
};

function getJsonLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  return JSON.parse(script!.innerHTML);
}

describe('BlogJsonLd', () => {
  it('renders a script tag with application/ld+json type', () => {
    const { container } = render(<BlogJsonLd {...defaultProps} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
  });

  it('outputs Article schema type', () => {
    const { container } = render(<BlogJsonLd {...defaultProps} />);
    const data = getJsonLd(container);
    expect(data['@type']).toBe('Article');
    expect(data['@context']).toBe('https://schema.org');
  });

  it('includes headline and description', () => {
    const { container } = render(<BlogJsonLd {...defaultProps} />);
    const data = getJsonLd(container);
    expect(data.headline).toBe('Test Article');
    expect(data.description).toBe('A test description');
  });

  it('includes dates', () => {
    const { container } = render(<BlogJsonLd {...defaultProps} />);
    const data = getJsonLd(container);
    expect(data.datePublished).toBe('2025-06-01T10:00:00Z');
    expect(data.dateModified).toBe('2025-06-02T10:00:00Z');
  });

  it('uses author name as Person when provided', () => {
    const { container } = render(<BlogJsonLd {...defaultProps} authorName="John Doe" />);
    const data = getJsonLd(container);
    expect(data.author['@type']).toBe('Person');
    expect(data.author.name).toBe('John Doe');
  });

  it('uses Organization as author when no authorName', () => {
    const { container } = render(<BlogJsonLd {...defaultProps} />);
    const data = getJsonLd(container);
    expect(data.author['@type']).toBe('Organization');
  });

  it('includes image when provided', () => {
    const { container } = render(<BlogJsonLd {...defaultProps} image="/img/test.jpg" />);
    const data = getJsonLd(container);
    expect(data.image).toBe('/img/test.jpg');
  });

  it('omits image when not provided', () => {
    const { container } = render(<BlogJsonLd {...defaultProps} />);
    const data = getJsonLd(container);
    expect(data.image).toBeUndefined();
  });

  it('includes articleSection when categoryName is provided', () => {
    const { container } = render(<BlogJsonLd {...defaultProps} categoryName="Tips" />);
    const data = getJsonLd(container);
    expect(data.articleSection).toBe('Tips');
  });

  it('includes publisher info', () => {
    const { container } = render(<BlogJsonLd {...defaultProps} />);
    const data = getJsonLd(container);
    expect(data.publisher['@type']).toBe('Organization');
    expect(data.publisher.logo['@type']).toBe('ImageObject');
  });
});
