export interface JwtAccessPayload {
  sub: number;
  email: string;
  role: string;
  type: 'access';
  /** Admin user ID who is impersonating `sub`. Absent on regular logins. */
  impersonatedBy?: number;
}

export interface JwtRefreshPayload {
  sub: number;
  type: 'refresh';
}

export interface Jwt2faPayload {
  sub: number;
  type: '2fa';
  iph?: string;
}

export interface AuthUser {
  id: number;
  email: string;
  role: string;
  fullName?: string;
  phone?: string;
  wholesaleGroup?: number | null;
  twoFactorEnabled?: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
