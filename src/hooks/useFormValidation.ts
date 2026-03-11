'use client';

import { useState, useCallback } from 'react';

type ValidationRule = {
  required?: string;
  min?: { value: number; message: string };
  max?: { value: number; message: string };
  minLength?: { value: number; message: string };
  maxLength?: { value: number; message: string };
  pattern?: { value: RegExp; message: string };
  custom?: (value: unknown, allValues: Record<string, unknown>) => string | null;
};

type ValidationRules = Record<string, ValidationRule>;

export function useFormValidation(rules: ValidationRules) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateField = useCallback((field: string, value: unknown, allValues: Record<string, unknown> = {}): string | null => {
    const rule = rules[field];
    if (!rule) return null;

    if (rule.required && (value === undefined || value === null || value === '')) {
      return rule.required;
    }

    const strVal = String(value ?? '');
    const numVal = Number(value);

    if (rule.minLength && strVal.length < rule.minLength.value && strVal.length > 0) {
      return rule.minLength.message;
    }

    if (rule.maxLength && strVal.length > rule.maxLength.value) {
      return rule.maxLength.message;
    }

    if (rule.min && !isNaN(numVal) && numVal < rule.min.value) {
      return rule.min.message;
    }

    if (rule.max && !isNaN(numVal) && numVal > rule.max.value) {
      return rule.max.message;
    }

    if (rule.pattern && strVal && !rule.pattern.value.test(strVal)) {
      return rule.pattern.message;
    }

    if (rule.custom) {
      return rule.custom(value, allValues);
    }

    return null;
  }, [rules]);

  const validateAll = useCallback((values: Record<string, unknown>): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    for (const field of Object.keys(rules)) {
      const error = validateField(field, values[field], values);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  }, [rules, validateField]);

  const setFieldError = useCallback((field: string, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  const clearError = useCallback((field: string) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  return { errors, validateAll, validateField, setFieldError, clearError, clearErrors };
}
