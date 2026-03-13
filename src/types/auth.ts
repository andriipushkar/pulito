export interface JwtAccessPayload {
  sub: number;
  email: string;
  role: string;
  type: 'access';
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
  wholesaleGroup?: number | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
