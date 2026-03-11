// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('sonner', () => ({
  Toaster: (props: any) => <div data-testid="sonner-toaster" data-position={props.position} />,
}));

import Toaster from './Toaster';

describe('Toaster', () => {
  it('renders without crash', () => {
    const { container } = render(<Toaster />);
    expect(container.querySelector('[data-testid="sonner-toaster"]')).toBeInTheDocument();
  });
});
