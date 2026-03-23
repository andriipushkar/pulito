// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(cleanup);

import SearchActionJsonLd from './SearchActionJsonLd';

function getJsonLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  return JSON.parse(script!.innerHTML);
}

describe('SearchActionJsonLd', () => {
  it('renders a JSON-LD script tag', () => {
    const { container } = render(<SearchActionJsonLd />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
  });

  it('outputs WebSite schema type', () => {
    const { container } = render(<SearchActionJsonLd />);
    const data = getJsonLd(container);
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('WebSite');
  });

  it('includes site name', () => {
    const { container } = render(<SearchActionJsonLd />);
    const data = getJsonLd(container);
    expect(data.name).toBe('Порошок');
  });

  it('includes SearchAction potentialAction', () => {
    const { container } = render(<SearchActionJsonLd />);
    const data = getJsonLd(container);
    expect(data.potentialAction['@type']).toBe('SearchAction');
    expect(data.potentialAction.target['@type']).toBe('EntryPoint');
  });

  it('includes query-input parameter', () => {
    const { container } = render(<SearchActionJsonLd />);
    const data = getJsonLd(container);
    expect(data.potentialAction['query-input']).toBe('required name=search_term_string');
  });

  it('has URL template containing search placeholder', () => {
    const { container } = render(<SearchActionJsonLd />);
    const data = getJsonLd(container);
    expect(data.potentialAction.target.urlTemplate).toContain('{search_term_string}');
  });
});
