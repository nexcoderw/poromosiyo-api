export type GovernancePagination<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type GovernanceUserResponse = {
  id: string;
  fullName: string;
  email: string;
  image: string | null;
  role:
    | 'CUSTOMER'
    | 'ADMIN'
    | 'SUPERADMIN';
  isActive: boolean;
  blockedAt: Date | null;
  blockedReason: string | null;
  emailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  blockedBy: {
    id: string;
    fullName: string;
    email: string;
    role:
      | 'ADMIN'
      | 'SUPERADMIN';
  } | null;
};

export type UserActivityResponse = {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  description: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: Date;

  subjectUser: {
    id: string;
    fullName: string;
    email: string;
    role:
      | 'CUSTOMER'
      | 'ADMIN'
      | 'SUPERADMIN';
  } | null;

  actorUser: {
    id: string;
    fullName: string;
    email: string;
    role:
      | 'CUSTOMER'
      | 'ADMIN'
      | 'SUPERADMIN';
  } | null;
};
