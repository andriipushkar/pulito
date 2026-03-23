// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormValidation } from './useFormValidation';

describe('useFormValidation', () => {
  it('returns empty errors initially', () => {
    const { result } = renderHook(() =>
      useFormValidation({ name: { required: 'Name is required' } })
    );

    expect(result.current.errors).toEqual({});
  });

  it('validates required fields', () => {
    const { result } = renderHook(() =>
      useFormValidation({ name: { required: 'Name is required' } })
    );

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateAll({ name: '' });
    });

    expect(isValid!).toBe(false);
    expect(result.current.errors.name).toBe('Name is required');
  });

  it('passes validation when required field has value', () => {
    const { result } = renderHook(() =>
      useFormValidation({ name: { required: 'Name is required' } })
    );

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateAll({ name: 'John' });
    });

    expect(isValid!).toBe(true);
    expect(result.current.errors).toEqual({});
  });

  it('validates minLength', () => {
    const { result } = renderHook(() =>
      useFormValidation({
        password: { minLength: { value: 8, message: 'At least 8 chars' } },
      })
    );

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateAll({ password: 'abc' });
    });

    expect(isValid!).toBe(false);
    expect(result.current.errors.password).toBe('At least 8 chars');
  });

  it('validates maxLength', () => {
    const { result } = renderHook(() =>
      useFormValidation({
        username: { maxLength: { value: 5, message: 'Max 5 chars' } },
      })
    );

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateAll({ username: 'toolongname' });
    });

    expect(isValid!).toBe(false);
    expect(result.current.errors.username).toBe('Max 5 chars');
  });

  it('validates min number', () => {
    const { result } = renderHook(() =>
      useFormValidation({
        age: { min: { value: 18, message: 'Must be 18+' } },
      })
    );

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateAll({ age: 10 });
    });

    expect(isValid!).toBe(false);
    expect(result.current.errors.age).toBe('Must be 18+');
  });

  it('validates max number', () => {
    const { result } = renderHook(() =>
      useFormValidation({
        quantity: { max: { value: 100, message: 'Max 100' } },
      })
    );

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateAll({ quantity: 150 });
    });

    expect(isValid!).toBe(false);
    expect(result.current.errors.quantity).toBe('Max 100');
  });

  it('validates pattern', () => {
    const { result } = renderHook(() =>
      useFormValidation({
        email: { pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' } },
      })
    );

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateAll({ email: 'notanemail' });
    });

    expect(isValid!).toBe(false);
    expect(result.current.errors.email).toBe('Invalid email');
  });

  it('validates with custom validator', () => {
    const { result } = renderHook(() =>
      useFormValidation({
        confirmPassword: {
          custom: (value, allValues) =>
            value !== allValues.password ? 'Passwords must match' : null,
        },
      })
    );

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateAll({ password: 'abc', confirmPassword: 'xyz' });
    });

    expect(isValid!).toBe(false);
    expect(result.current.errors.confirmPassword).toBe('Passwords must match');
  });

  it('custom validator passes when valid', () => {
    const { result } = renderHook(() =>
      useFormValidation({
        confirmPassword: {
          custom: (value, allValues) =>
            value !== allValues.password ? 'Passwords must match' : null,
        },
      })
    );

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateAll({ password: 'abc', confirmPassword: 'abc' });
    });

    expect(isValid!).toBe(true);
  });

  it('clearError removes specific field error', () => {
    const { result } = renderHook(() =>
      useFormValidation({
        name: { required: 'Required' },
        email: { required: 'Required' },
      })
    );

    act(() => {
      result.current.validateAll({ name: '', email: '' });
    });

    expect(result.current.errors.name).toBe('Required');
    expect(result.current.errors.email).toBe('Required');

    act(() => {
      result.current.clearError('name');
    });

    expect(result.current.errors.name).toBeUndefined();
    expect(result.current.errors.email).toBe('Required');
  });

  it('clearErrors removes all errors', () => {
    const { result } = renderHook(() =>
      useFormValidation({
        name: { required: 'Required' },
        email: { required: 'Required' },
      })
    );

    act(() => {
      result.current.validateAll({ name: '', email: '' });
    });

    expect(Object.keys(result.current.errors)).toHaveLength(2);

    act(() => {
      result.current.clearErrors();
    });

    expect(result.current.errors).toEqual({});
  });

  it('setFieldError sets a custom error on a field', () => {
    const { result } = renderHook(() =>
      useFormValidation({ name: {} })
    );

    act(() => {
      result.current.setFieldError('name', 'Server error');
    });

    expect(result.current.errors.name).toBe('Server error');
  });

  it('validateField validates a single field', () => {
    const { result } = renderHook(() =>
      useFormValidation({ name: { required: 'Required' } })
    );

    const error = result.current.validateField('name', '', {});
    expect(error).toBe('Required');

    const noError = result.current.validateField('name', 'John', {});
    expect(noError).toBeNull();
  });

  it('validateField returns null for unknown fields', () => {
    const { result } = renderHook(() =>
      useFormValidation({ name: { required: 'Required' } })
    );

    const error = result.current.validateField('unknown', '', {});
    expect(error).toBeNull();
  });

  it('validates multiple rules on same field (required + minLength)', () => {
    const { result } = renderHook(() =>
      useFormValidation({
        password: {
          required: 'Password required',
          minLength: { value: 8, message: 'Too short' },
        },
      })
    );

    let isValid: boolean;
    act(() => {
      isValid = result.current.validateAll({ password: '' });
    });
    expect(isValid!).toBe(false);
    expect(result.current.errors.password).toBe('Password required');

    act(() => {
      isValid = result.current.validateAll({ password: 'abc' });
    });
    expect(isValid!).toBe(false);
    expect(result.current.errors.password).toBe('Too short');

    act(() => {
      isValid = result.current.validateAll({ password: 'longpassword' });
    });
    expect(isValid!).toBe(true);
  });
});
