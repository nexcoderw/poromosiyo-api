import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaService,
} from '@poromosiyo/db';

import type {
  AuthPrincipal,
  SessionMetadata,
} from '../../../auth/types/auth.types';

type GovernedTargetRole =
  | 'CUSTOMER'
  | 'ADMIN';

@Injectable()
export class AccountGovernanceService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async block(
    input: {
      targetId: string;
      targetRole:
        GovernedTargetRole;
      actor: AuthPrincipal;
      reason: string;
      metadata:
        SessionMetadata;
      action: string;
    },
  ): Promise<void> {
    const target =
      await this.getTarget(
        input.targetId,
        input.targetRole,
      );

    if (
      !target.isActive &&
      target.blockedAt !==
        null
    ) {
      return;
    }

    const now =
      new Date();

    await this.prisma
      .$transaction(
        async (
          transaction,
        ) => {
          const sessions =
            await transaction
              .authSession
              .findMany({
                where: {
                  userId:
                    target.id,
                  revokedAt:
                    null,
                },
                select: {
                  id:
                    true,
                },
              });

          const sessionIds =
            sessions.map(
              (session) =>
                session.id,
            );

          await transaction
            .user
            .update({
              where: {
                id:
                  target.id,
              },
              data: {
                isActive:
                  false,
                blockedAt:
                  now,
                blockedReason:
                  input.reason
                    .trim(),
                blockedByUserId:
                  input.actor.id,
              },
            });

          await transaction
            .authSession
            .updateMany({
              where: {
                userId:
                  target.id,
                revokedAt:
                  null,
              },
              data: {
                revokedAt:
                  now,
                revocationReason:
                  'account_blocked',
              },
            });

          if (
            sessionIds.length >
            0
          ) {
            await transaction
              .refreshToken
              .updateMany({
                where: {
                  sessionId: {
                    in:
                      sessionIds,
                  },
                  revokedAt:
                    null,
                },
                data: {
                  revokedAt:
                    now,
                },
              });
          }

          await transaction
            .userActivity
            .create({
              data: {
                subjectUserId:
                  target.id,
                actorUserId:
                  input.actor.id,
                action:
                  input.action,
                resourceType:
                  'USER',
                resourceId:
                  target.id,
                description:
                  input.reason
                    .trim(),
                ipAddress:
                  input.metadata
                    .ipAddress,
                userAgent:
                  input.metadata
                    .userAgent,
              },
            });
        },
      );
  }

  async unblock(
    input: {
      targetId: string;
      targetRole:
        GovernedTargetRole;
      actor: AuthPrincipal;
      metadata:
        SessionMetadata;
      action: string;
    },
  ): Promise<void> {
    const target =
      await this.getTarget(
        input.targetId,
        input.targetRole,
      );

    if (
      target.isActive &&
      target.blockedAt ===
        null
    ) {
      return;
    }

    await this.prisma
      .$transaction(
        async (
          transaction,
        ) => {
          await transaction
            .user
            .update({
              where: {
                id:
                  target.id,
              },
              data: {
                isActive:
                  true,
                blockedAt:
                  null,
                blockedReason:
                  null,
                blockedByUserId:
                  null,
                failedLoginAttempts:
                  0,
                lockedUntil:
                  null,
              },
            });

          await transaction
            .userActivity
            .create({
              data: {
                subjectUserId:
                  target.id,
                actorUserId:
                  input.actor.id,
                action:
                  input.action,
                resourceType:
                  'USER',
                resourceId:
                  target.id,
                description:
                  'Account unblocked.',
                ipAddress:
                  input.metadata
                    .ipAddress,
                userAgent:
                  input.metadata
                    .userAgent,
              },
            });
        },
      );
  }

  private async getTarget(
    id: string,
    expectedRole:
      GovernedTargetRole,
  ) {
    const user =
      await this.prisma
        .user
        .findUnique({
          where: {
            id,
          },
          select: {
            id: true,
            role: true,
            isActive:
              true,
            blockedAt:
              true,
          },
        });

    if (
      !user ||
      user.role !==
        expectedRole
    ) {
      throw new NotFoundException(
        'Account not found.',
      );
    }

    if (
      user.role ===
      'SUPERADMIN'
    ) {
      throw new ConflictException(
        'SUPERADMIN accounts cannot be modified through this operation.',
      );
    }

    return user;
  }
}
