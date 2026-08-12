import { Injectable } from '@nestjs/common';
import { PrismaService } from '@poromosiyo/db';

import type { AdminDashboardResponse } from './admin-dashboard.types';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(): Promise<AdminDashboardResponse> {
    const [
      customerTotal,
      customerActive,
      customerBlocked,

      adminTotal,
      regularAdminTotal,
      superadminTotal,
      adminActive,
      adminBlocked,

      productTotal,
      productDraft,
      productPublished,
      productArchived,

      categoryTotal,
      categoryActive,

      brandTotal,
      brandActive,

      storeTotal,
      storeActive,

      recentActivities,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({
        where: {
          role: 'CUSTOMER',
        },
      }),

      this.prisma.user.count({
        where: {
          role: 'CUSTOMER',
          isActive: true,
        },
      }),

      this.prisma.user.count({
        where: {
          role: 'CUSTOMER',
          isActive: false,
          blockedAt: {
            not: null,
          },
        },
      }),

      this.prisma.user.count({
        where: {
          role: {
            in: ['ADMIN', 'SUPERADMIN'],
          },
        },
      }),

      this.prisma.user.count({
        where: {
          role: 'ADMIN',
        },
      }),

      this.prisma.user.count({
        where: {
          role: 'SUPERADMIN',
        },
      }),

      this.prisma.user.count({
        where: {
          role: {
            in: ['ADMIN', 'SUPERADMIN'],
          },
          isActive: true,
        },
      }),

      this.prisma.user.count({
        where: {
          role: 'ADMIN',
          isActive: false,
          blockedAt: {
            not: null,
          },
        },
      }),

      this.prisma.product.count(),

      this.prisma.product.count({
        where: {
          status: 'DRAFT',
        },
      }),

      this.prisma.product.count({
        where: {
          status: 'ACTIVE',
        },
      }),

      this.prisma.product.count({
        where: {
          status: 'ARCHIVED',
        },
      }),

      this.prisma.category.count(),

      this.prisma.category.count({
        where: {
          isActive: true,
        },
      }),

      this.prisma.brand.count(),

      this.prisma.brand.count({
        where: {
          isActive: true,
        },
      }),

      this.prisma.store.count(),

      this.prisma.store.count({
        where: {
          isActive: true,
        },
      }),

      this.prisma.userActivity.findMany({
        take: 10,

        orderBy: {
          createdAt: 'desc',
        },

        select: {
          id: true,
          action: true,
          resourceType: true,
          resourceId: true,
          description: true,
          createdAt: true,

          actorUser: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },

          subjectUser: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return {
      customers: {
        total: customerTotal,
        active: customerActive,
        blocked: customerBlocked,
      },

      admins: {
        total: adminTotal,
        regular: regularAdminTotal,
        superadmins: superadminTotal,
        active: adminActive,
        blocked: adminBlocked,
      },

      products: {
        total: productTotal,
        draft: productDraft,
        published: productPublished,
        archived: productArchived,
      },

      categories: {
        total: categoryTotal,
        active: categoryActive,
      },

      stores: {
        total: storeTotal,
        active: storeActive,
      },

      brands: {
        total: brandTotal,
        active: brandActive,
      },

      recentActivities,
    };
  }
}
