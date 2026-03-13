import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { env } from '@/config/env';
import type { JwtAccessPayload, JwtRefreshPayload, Jwt2faPayload } from '@/types/auth';

const TTL_REGEX = /^(\d+)(s|m|h|d)$/;

const TTL_MULTIPLIERS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
};

export function parseTtlToSeconds(ttl: string): number {
  const match = TTL_REGEX.exec(ttl);
  if (!match) {
    throw new Error(`Invalid TTL format: ${ttl}`);
  }
  const [, value, unit] = match;
  return Number(value) * TTL_MULTIPLIERS[unit];
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function signAccessToken(payload: Omit<JwtAccessPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'access' }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: parseTtlToSeconds(env.JWT_ACCESS_TTL),
  });
}

export function signRefreshToken(payload: Omit<JwtRefreshPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'refresh' }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: parseTtlToSeconds(env.JWT_REFRESH_TTL),
  });
}

export function verifyAccessToken(token: string): JwtAccessPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as unknown as JwtAccessPayload;
  if (decoded.type !== 'access') {
    throw new jwt.JsonWebTokenError('Invalid token type');
  }
  return decoded;
}

export function verifyRefreshToken(token: string): JwtRefreshPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as unknown as JwtRefreshPayload;
  if (decoded.type !== 'refresh') {
    throw new jwt.JsonWebTokenError('Invalid token type');
  }
  return decoded;
}

export function sign2faToken(payload: Omit<Jwt2faPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: '2fa' }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: 300, // 5 minutes
  });
}

export function verify2faToken(token: string): Jwt2faPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as unknown as Jwt2faPayload;
  if (decoded.type !== '2fa') {
    throw new jwt.JsonWebTokenError('Invalid token type');
  }
  return decoded;
}

export function getTokenRemainingSeconds(token: string): number {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  if (!decoded?.exp) {
    return 0;
  }
  const remaining = decoded.exp - Math.floor(Date.now() / 1000);
  return Math.max(0, remaining);
}
