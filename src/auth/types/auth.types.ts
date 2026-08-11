export type AuthRole = 'CUSTOMER' | 'ADMIN';

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

export type AuthenticationResult = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthenticatedUser;
};
