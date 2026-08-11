export type AuthSessionSummary = {
  id: string;
  current: boolean;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
};

export type AuthenticationMethods = {
  password: boolean;
  google: boolean;
};
