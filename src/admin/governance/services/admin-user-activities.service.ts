import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@poromosiyo/db';

import type {
  GovernancePagination,
  UserActivityResponse,
} from '../admin-governance.types';
import type { ListGlobalActivitiesDto } from '../dto/list-global-activities.dto';
import type { ListUserActivitiesDto } from '../dto/list-user-activities.dto';

@Injectable()
export class AdminUserActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll(
    query: ListGlobalActivitiesDto,
  ): Promise<GovernancePagination<UserActivityResponse>> {
    const from = query.from ? new Date(query.from) : undefined;

    const to = query.to ? new Date(query.to) : undefined;

    if (from && to && from.getTime() > to.getTime()) {
      throw new BadRequestException('`from` must be before or equal to `to`.');
    }

    const createdAt =
      from || to
        ? {
            ...(from
              ? {
                  gte: from,
                }
              : {}),

            ...(to
              ? {
                  lte: to,
                }
              : {}),
          }
        : undefined;

    const where = {
      ...(query.action
        ? {
            action: query.action,
          }
        : {}),

      ...(query.resourceType
        ? {
            resourceType: query.resourceType,
          }
        : {}),

      ...(query.resourceId
        ? {
            resourceId: query.resourceId,
          }
        : {}),

      ...(query.actorUserId
        ? {
            actorUserId: query.actorUserId,
          }
        : {}),

      ...(query.subjectUserId
        ? {
            subjectUserId: query.subjectUserId,
          }
        : {}),

      ...(createdAt
        ? {
            createdAt,
          }
        : {}),
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

        include: activityInclude,
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

  async listCustomerActivities(
    userId: string,
    query: ListUserActivitiesDto,
  ): Promise<GovernancePagination<UserActivityResponse>> {
    await this.assertUserRole(userId, ['CUSTOMER']);

    return this.listUser(userId, query);
  }

  async listAdminActivities(
    userId: string,
    query: ListUserActivitiesDto,
  ): Promise<GovernancePagination<UserActivityResponse>> {
    await this.assertUserRole(userId, ['ADMIN', 'SUPERADMIN']);

    return this.listUser(userId, query);
  }

  private async listUser(
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

        include: activityInclude,
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

const activityInclude = {
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
} as const;
