// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import FaqJsonLd from './FaqJsonLd';

describe('FaqJsonLd', () => {
  it('renders ld+json script with FAQPage type', () => {
    const items = [{ question: 'What?', answer: 'This.' }];
    const { container } = render(<FaqJsonLd items={items} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
    const json = JSON.parse(script!.textContent!);
    expect(json['@type']).toBe('FAQPage');
    expect(json.mainEntity[0].name).toBe('What?');
  });
});
