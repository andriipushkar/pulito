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
