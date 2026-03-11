// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PhoneInput from './PhoneInput';

describe('debug', () => {
  it('renders first', () => {
    render(<PhoneInput />);
    expect(screen.getByPlaceholderText('+38 (0XX) XXX-XX-XX')).toBeInTheDocument();
  });

  it('check onChange with getByPlaceholder after first render', () => {
    const onChange = vi.fn();
    render(<PhoneInput onChange={onChange} value="" />);
    const inputs = screen.getAllByPlaceholderText('+38 (0XX) XXX-XX-XX');
    console.log('inputs count:', inputs.length);
    fireEvent.change(inputs[0], { target: { value: '093123' } });
    console.log('onChange called:', onChange.mock.calls.length);
    if (onChange.mock.calls.length > 0) {
      console.log('call arg:', onChange.mock.calls[0][0]?.target?.value);
    }
  });
});
