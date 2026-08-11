export type AuthRole =
  | 'CUSTOMER'
  | 'ADMIN';

export type SessionMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};

export type AuthenticatedUser = {
  id: string;
  fullName: string;
  email: string;
  image: string | null;
  role: AuthRole;
  emailVerified: boolean;
};

export type AuthPrincipal =
  AuthenticatedUser & {
    sessionId: string;
  };

export type AuthJwtPayload = {
  sub: string;
  sid: string;
  role: AuthRole;
  iat?: number;
  exp?: number;
};

export type AuthenticationResult = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthenticatedUser;
};
