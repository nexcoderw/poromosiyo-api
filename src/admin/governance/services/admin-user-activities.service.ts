import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@poromosiyo/db';

import type {
  GovernancePagination,
  UserActivityResponse,
} from '../admin-governance.types';
import type { ListUserActivitiesDto } from '../dto/list-user-activities.dto';

@Injectable()
export class AdminUserActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCustomerActivities(
    userId: string,
    query: ListUserActivitiesDto,
  ): Promise<GovernancePagination<UserActivityResponse>> {
    await this.assertUserRole(userId, ['CUSTOMER']);

    return this.list(userId, query);
  }

  async listAdminActivities(
    userId: string,
    query: ListUserActivitiesDto,
  ): Promise<GovernancePagination<UserActivityResponse>> {
    await this.assertUserRole(userId, ['ADMIN', 'SUPERADMIN']);

    return this.list(userId, query);
  }

  private async list(
    userId: string,
    query: ListUserActivitiesDto,
  ): Promise<GovernancePagination<UserActivityResponse>> {
    const where = {
      AND: [
        {
          OR: [
            {
              subjectUserId: userId,
            },
            {
              actorUserId: userId,
            },
          ],
        },

        ...(query.action
          ? [
              {
                action: query.action,
              },
            ]
          : []),
      ],
    };

    const [total, activities] = await this.prisma.$transaction([
      this.prisma.userActivity.count({
        where,
      }),

      this.prisma.userActivity.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          subjectUser: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },

          actorUser: {
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
      items: activities as unknown as UserActivityResponse[],
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  private async assertUserRole(
    userId: string,
    roles: readonly string[],
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        role: true,
      },
    });

    if (!user || !roles.includes(user.role)) {
      throw new NotFoundException('Account not found.');
    }
  }
}
