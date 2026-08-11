import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@poromosiyo/db';

import type {
  AuthPrincipal,
  SessionMetadata,
} from '../../../auth/types/auth.types';
import { GOVERNANCE_ACTIVITY_ACTION } from '../admin-governance.constants';
import type {
  GovernancePagination,
  GovernanceUserResponse,
} from '../admin-governance.types';
import type { ListGovernedUsersDto } from '../dto/list-governed-users.dto';
import { AccountGovernanceService } from './account-governance.service';

@Injectable()
export class AdminCustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly governance: AccountGovernanceService,
  ) {}

  async list(
    query: ListGovernedUsersDto,
  ): Promise<GovernancePagination<GovernanceUserResponse>> {
    const search = query.search?.trim();

    const where = {
      role: 'CUSTOMER' as const,

      ...(search
        ? {
            OR: [
              {
                fullName: {
                  contains: search,
                },
              },
              {
                email: {
                  contains: search.toLowerCase(),
                },
              },
            ],
          }
        : {}),

      ...(query.status === 'ACTIVE'
        ? {
            isActive: true,
          }
        : query.status === 'BLOCKED'
          ? {
              isActive: false,
              blockedAt: {
                not: null,
              },
            }
          : {}),

      ...(query.emailVerified === undefined
        ? {}
        : query.emailVerified
          ? {
              emailVerifiedAt: {
                not: null,
              },
            }
          : {
              emailVerifiedAt: null,
            }),
    };

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({
        where,
      }),

      this.prisma.user.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: userSelect,
      }),
    ]);

    return {
      items: users.map(serializeUser),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async get(id: string): Promise<GovernanceUserResponse> {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        role: 'CUSTOMER',
      },
      select: userSelect,
    });

    if (!user) {
      throw new NotFoundException('Customer not found.');
    }

    return serializeUser(user);
  }

  block(
    id: string,
    actor: AuthPrincipal,
    reason: string,
    metadata: SessionMetadata,
  ): Promise<void> {
    return this.governance.block({
      targetId: id,
      targetRole: 'CUSTOMER',
      actor,
      reason,
      metadata,
      action: GOVERNANCE_ACTIVITY_ACTION.CUSTOMER_BLOCKED,
    });
  }

  unblock(
    id: string,
    actor: AuthPrincipal,
    metadata: SessionMetadata,
  ): Promise<void> {
    return this.governance.unblock({
      targetId: id,
      targetRole: 'CUSTOMER',
      actor,
      metadata,
      action: GOVERNANCE_ACTIVITY_ACTION.CUSTOMER_UNBLOCKED,
    });
  }
}

const userSelect = {
  id: true,
  fullName: true,
  email: true,
  image: true,
  role: true,
  isActive: true,
  blockedAt: true,
  blockedReason: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,

  blockedBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
    },
  },
} as const;

function serializeUser(user: {
  id: string;
  fullName: string;
  email: string;
  image: string | null;
  role: string;
  isActive: boolean;
  blockedAt: Date | null;
  blockedReason: string | null;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  blockedBy: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
}): GovernanceUserResponse {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    image: user.image,
    role: toRole(user.role),
    isActive: user.isActive,
    blockedAt: user.blockedAt,
    blockedReason: user.blockedReason,
    emailVerified: user.emailVerifiedAt !== null,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    blockedBy: user.blockedBy
      ? {
          id: user.blockedBy.id,
          fullName: user.blockedBy.fullName,
          email: user.blockedBy.email,
          role: user.blockedBy.role === 'SUPERADMIN' ? 'SUPERADMIN' : 'ADMIN',
        }
      : null,
  };
}

function toRole(role: string): 'CUSTOMER' | 'ADMIN' | 'SUPERADMIN' {
  if (role === 'CUSTOMER' || role === 'ADMIN' || role === 'SUPERADMIN') {
    return role;
  }

  throw new Error(`Unsupported role: ${role}`);
}
