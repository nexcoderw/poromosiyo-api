import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaService,
} from '@poromosiyo/db';

import {
  PasswordHasherService,
} from '../../../auth/services/password-hasher.service';
import type {
  AuthPrincipal,
  SessionMetadata,
} from '../../../auth/types/auth.types';
import {
  GOVERNANCE_ACTIVITY_ACTION,
} from '../admin-governance.constants';
import type {
  GovernancePagination,
  GovernanceUserResponse,
} from '../admin-governance.types';
import type {
  CreateAdminDto,
} from '../dto/create-admin.dto';
import type {
  ListGovernedUsersDto,
} from '../dto/list-governed-users.dto';
import {
  AccountGovernanceService,
} from './account-governance.service';

@Injectable()
export class AdminAdminsService {
  constructor(
    private readonly prisma:
      PrismaService,
    private readonly passwordHasher:
      PasswordHasherService,
    private readonly governance:
      AccountGovernanceService,
  ) {}

  async list(
    query:
      ListGovernedUsersDto,
  ): Promise<
    GovernancePagination<
      GovernanceUserResponse
    >
  > {
    const search =
      query.search?.trim();

    const where = {
      role: {
        in: [
          'ADMIN',
          'SUPERADMIN',
        ] as const,
      },

      ...(search
        ? {
            OR: [
              {
                fullName: {
                  contains:
                    search,
                },
              },
              {
                email: {
                  contains:
                    search
                      .toLowerCase(),
                },
              },
            ],
          }
        : {}),

      ...(query.status ===
        'ACTIVE'
        ? {
            isActive:
              true,
          }
        : query.status ===
            'BLOCKED'
          ? {
              isActive:
                false,
              blockedAt: {
                not:
                  null,
              },
            }
          : {}),

      ...(query.emailVerified ===
      undefined
        ? {}
        : query.emailVerified
          ? {
              emailVerifiedAt: {
                not:
                  null,
              },
            }
          : {
              emailVerifiedAt:
                null,
            }),
    };

    const [
      total,
      users,
    ] =
      await this.prisma
        .$transaction([
          this.prisma
            .user
            .count({
              where,
            }),

          this.prisma
            .user
            .findMany({
              where,
              skip:
                (
                  query.page -
                  1
                ) *
                query.limit,
              take:
                query.limit,
              orderBy: [
                {
                  role:
                    'desc',
                },
                {
                  createdAt:
                    'desc',
                },
              ],
              select:
                userSelect,
            }),
        ]);

    return {
      items:
        users.map(
          serializeUser,
        ),
      page:
        query.page,
      limit:
        query.limit,
      total,
      totalPages:
        Math.ceil(
          total /
          query.limit,
        ),
    };
  }

  async get(
    id: string,
  ): Promise<
    GovernanceUserResponse
  > {
    const user =
      await this.prisma
        .user
        .findFirst({
          where: {
            id,
            role: {
              in: [
                'ADMIN',
                'SUPERADMIN',
              ],
            },
          },
          select:
            userSelect,
        });

    if (!user) {
      throw new NotFoundException(
        'Administrator not found.',
      );
    }

    return serializeUser(
      user,
    );
  }

  async create(
    dto: CreateAdminDto,
    actor: AuthPrincipal,
    metadata:
      SessionMetadata,
  ): Promise<
    GovernanceUserResponse
  > {
    const email =
      dto.email
        .trim()
        .toLowerCase();

    const fullName =
      dto.fullName
        .trim()
        .replace(
          /\s+/g,
          ' ',
        );

    const existing =
      await this.prisma
        .user
        .findUnique({
          where: {
            email,
          },
          select: {
            id:
              true,
          },
        });

    if (existing) {
      throw new ConflictException(
        'An account with this email already exists.',
      );
    }

    const passwordHash =
      await this.passwordHasher
        .hash(
          dto.password,
        );

    const now =
      new Date();

    try {
      const user =
        await this.prisma
          .$transaction(
            async (
              transaction,
            ) => {
              const created =
                await transaction
                  .user
                  .create({
                    data: {
                      fullName,
                      email,
                      passwordHash,
                      passwordChangedAt:
                        now,
                      role:
                        'ADMIN',
                      isActive:
                        true,
                    },

                    select:
                      userSelect,
                  });

              await transaction
                .userActivity
                .create({
                  data: {
                    subjectUserId:
                      created.id,
                    actorUserId:
                      actor.id,
                    action:
                      GOVERNANCE_ACTIVITY_ACTION
                        .ADMIN_CREATED,
                    resourceType:
                      'USER',
                    resourceId:
                      created.id,
                    description:
                      'Administrator account created.',
                    ipAddress:
                      metadata.ipAddress,
                    userAgent:
                      metadata.userAgent,
                  },
                });

              return created;
            },
          );

      return serializeUser(
        user,
      );
    } catch (
      error: unknown
    ) {
      if (
        isPrismaUniqueError(
          error,
        )
      ) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }

      throw error;
    }
  }

  block(
    id: string,
    actor: AuthPrincipal,
    reason: string,
    metadata:
      SessionMetadata,
  ): Promise<void> {
    return this.governance
      .block({
        targetId:
          id,
        targetRole:
          'ADMIN',
        actor,
        reason,
        metadata,
        action:
          GOVERNANCE_ACTIVITY_ACTION
            .ADMIN_BLOCKED,
      });
  }

  unblock(
    id: string,
    actor: AuthPrincipal,
    metadata:
      SessionMetadata,
  ): Promise<void> {
    return this.governance
      .unblock({
        targetId:
          id,
        targetRole:
          'ADMIN',
        actor,
        metadata,
        action:
          GOVERNANCE_ACTIVITY_ACTION
            .ADMIN_UNBLOCKED,
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
      fullName:
        true,
      email: true,
      role: true,
    },
  },
} as const;

function serializeUser(
  user: {
    id: string;
    fullName: string;
    email: string;
    image:
      | string
      | null;
    role: string;
    isActive: boolean;
    blockedAt:
      | Date
      | null;
    blockedReason:
      | string
      | null;
    emailVerifiedAt:
      | Date
      | null;
    lastLoginAt:
      | Date
      | null;
    createdAt: Date;
    updatedAt: Date;
    blockedBy: {
      id: string;
      fullName: string;
      email: string;
      role: string;
    } | null;
  },
): GovernanceUserResponse {
  if (
    user.role !== 'ADMIN' &&
    user.role !== 'SUPERADMIN'
  ) {
    throw new Error(
      `Unsupported admin role: ${user.role}`,
    );
  }

  return {
    id:
      user.id,
    fullName:
      user.fullName,
    email:
      user.email,
    image:
      user.image,
    role:
      user.role,
    isActive:
      user.isActive,
    blockedAt:
      user.blockedAt,
    blockedReason:
      user.blockedReason,
    emailVerified:
      user.emailVerifiedAt !==
      null,
    lastLoginAt:
      user.lastLoginAt,
    createdAt:
      user.createdAt,
    updatedAt:
      user.updatedAt,
    blockedBy:
      user.blockedBy
        ? {
            id:
              user.blockedBy.id,
            fullName:
              user.blockedBy
                .fullName,
            email:
              user.blockedBy.email,
            role:
              user.blockedBy.role ===
                'SUPERADMIN'
                ? 'SUPERADMIN'
                : 'ADMIN',
          }
        : null,
  };
}

function isPrismaUniqueError(
  error: unknown,
): boolean {
  return (
    typeof error ===
      'object' &&
    error !== null &&
    'code' in error &&
    (
      error as {
        code?: unknown;
      }
    ).code === 'P2002'
  );
}
