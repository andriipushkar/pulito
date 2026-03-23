import { describe, it, expect } from 'vitest';
import { AuthError } from './auth-errors';

describe('AuthError', () => {
  it('creates error with message and statusCode', () => {
    const err = new AuthError('Unauthorized', 401);
    expect(err.message).toBe('Unauthorized');
    expect(err.statusCode).toBe(401);
    expect(err.name).toBe('AuthError');
  });

  it('is instance of Error', () => {
    const err = new AuthError('Forbidden', 403);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AuthError);
  });
});
