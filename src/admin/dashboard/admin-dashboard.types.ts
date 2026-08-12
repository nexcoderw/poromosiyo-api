export type AdminDashboardResponse = {
  customers: {
    total: number;
    active: number;
    blocked: number;
  };

  admins: {
    total: number;
    regular: number;
    superadmins: number;
    active: number;
    blocked: number;
  };

  products: {
    total: number;
    draft: number;
    published: number;
    archived: number;
  };

  categories: {
    total: number;
    active: number;
  };

  brands: {
    total: number;
    active: number;
  };

  recentActivities: Array<{
    id: string;
    action: string;
    resourceType: string | null;
    resourceId: string | null;
    description: string | null;
    createdAt: Date;

    actorUser: {
      id: string;
      fullName: string;
      email: string;
      role:
        | 'CUSTOMER'
        | 'ADMIN'
        | 'SUPERADMIN';
    } | null;

    subjectUser: {
      id: string;
      fullName: string;
      email: string;
      role:
        | 'CUSTOMER'
        | 'ADMIN'
        | 'SUPERADMIN';
    } | null;
  }>;
};
