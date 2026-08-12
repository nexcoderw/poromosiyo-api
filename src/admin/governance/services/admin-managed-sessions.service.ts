import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@poromosiyo/db';

import type {
  AuthPrincipal,
  SessionMetadata,
} from '../../../auth/types/auth.types';
import type { ManagedAuthSessionResponse } from '../admin-governance.types';

type ManagedRole = 'CUSTOMER' | 'ADMIN';

@Injectable()
export class AdminManagedSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  listCustomer(userId: string): Promise<ManagedAuthSessionResponse[]> {
    return this.list(userId, 'CUSTOMER');
  }

  listAdmin(userId: string): Promise<ManagedAuthSessionResponse[]> {
    return this.list(userId, 'ADMIN');
  }

  revokeCustomer(
    userId: string,
    sessionId: string,
    actor: AuthPrincipal,
    metadata: SessionMetadata,
  ): Promise<void> {
    return this.revoke(
      userId,
      'CUSTOMER',
      sessionId,
      actor,
      metadata,
      'CUSTOMER_SESSION_REVOKED',
    );
  }

  revokeAdmin(
    userId: string,
    sessionId: string,
    actor: AuthPrincipal,
    metadata: SessionMetadata,
  ): Promise<void> {
    return this.revoke(
      userId,
      'ADMIN',
      sessionId,
      actor,
      metadata,
      'ADMIN_SESSION_REVOKED',
    );
  }

  logoutAllCustomer(
    userId: string,
    actor: AuthPrincipal,
    metadata: SessionMetadata,
  ): Promise<void> {
    return this.logoutAll(
      userId,
      'CUSTOMER',
      actor,
      metadata,
      'CUSTOMER_LOGOUT_ALL',
    );
  }

  logoutAllAdmin(
    userId: string,
    actor: AuthPrincipal,
    metadata: SessionMetadata,
  ): Promise<void> {
    return this.logoutAll(userId, 'ADMIN', actor, metadata, 'ADMIN_LOGOUT_ALL');
  }

  private async list(
    userId: string,
    role: ManagedRole,
  ): Promise<ManagedAuthSessionResponse[]> {
    await this.assertTargetRole(userId, role);

    return this.prisma.authSession.findMany({
      where: {
        userId,
        revokedAt: null,

        expiresAt: {
          gt: new Date(),
        },
      },

      orderBy: [
        {
          lastSeenAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],

      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
      },
    });
  }

  private async revoke(
    userId: string,
    role: ManagedRole,
    sessionId: string,
    actor: AuthPrincipal,
    metadata: SessionMetadata,
    action: string,
  ): Promise<void> {
    await this.assertTargetRole(userId, role);

    const session = await this.prisma.authSession.findFirst({
      where: {
        id: sessionId,

        userId,
      },

      select: {
        id: true,

        revokedAt: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Authentication session not found.');
    }

    if (session.revokedAt !== null) {
      return;
    }

    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.authSession.updateMany({
        where: {
          id: sessionId,

          userId,

          revokedAt: null,
        },

        data: {
          revokedAt: now,

          revocationReason: 'admin_revoked_session',
        },
      });

      if (revoked.count !== 1) {
        return;
      }

      await transaction.refreshToken.updateMany({
        where: {
          sessionId,

          revokedAt: null,
        },

        data: {
          revokedAt: now,
        },
      });

      await transaction.userActivity.create({
        data: {
          subjectUserId: userId,

          actorUserId: actor.id,

          action,

          resourceType: 'AUTH_SESSION',

          resourceId: sessionId,

          description: 'Administrator revoked an authentication session.',

          ipAddress: metadata.ipAddress,

          userAgent: metadata.userAgent,
        },
      });
    });
  }

  private async logoutAll(
    userId: string,
    role: ManagedRole,
    actor: AuthPrincipal,
    metadata: SessionMetadata,
    action: string,
  ): Promise<void> {
    await this.assertTargetRole(userId, role);

    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      const sessions = await transaction.authSession.findMany({
        where: {
          userId,

          revokedAt: null,
        },

        select: {
          id: true,
        },
      });

      if (sessions.length === 0) {
        return;
      }

      const sessionIds = sessions.map((session) => session.id);

      await transaction.authSession.updateMany({
        where: {
          id: {
            in: sessionIds,
          },

          revokedAt: null,
        },

        data: {
          revokedAt: now,

          revocationReason: 'admin_logout_all',
        },
      });

      await transaction.refreshToken.updateMany({
        where: {
          sessionId: {
            in: sessionIds,
          },

          revokedAt: null,
        },

        data: {
          revokedAt: now,
        },
      });

      await transaction.userActivity.create({
        data: {
          subjectUserId: userId,

          actorUserId: actor.id,

          action,

          resourceType: 'USER',

          resourceId: userId,

          description: `Administrator revoked ${sessionIds.length} authentication session(s).`,

          ipAddress: metadata.ipAddress,

          userAgent: metadata.userAgent,

          metadata: {
            revokedSessions: sessionIds.length,
          },
        },
      });
    });
  }

  private async assertTargetRole(
    userId: string,
    expectedRole: ManagedRole,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        role: true,
      },
    });

    if (!user || user.role !== expectedRole) {
      throw new NotFoundException('Account not found.');
    }
  }
}
