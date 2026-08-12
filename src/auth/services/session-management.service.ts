import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@poromosiyo/db';

import type { AuthSessionSummary } from '../types/auth-management.types';
import type { AuthPrincipal } from '../types/auth.types';

@Injectable()
export class SessionManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async list(principal: AuthPrincipal): Promise<AuthSessionSummary[]> {
    const sessions = await this.prisma.authSession.findMany({
      where: {
        userId: principal.id,

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

    return sessions.map((session) => ({
      ...session,

      current: session.id === principal.sessionId,
    }));
  }

  async revoke(principal: AuthPrincipal, sessionId: string): Promise<void> {
    const session = await this.prisma.authSession.findFirst({
      where: {
        id: sessionId,

        userId: principal.id,
      },

      select: {
        id: true,
        revokedAt: true,
        userAgent: true,
        ipAddress: true,
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
          id: session.id,

          userId: principal.id,

          revokedAt: null,
        },

        data: {
          revokedAt: now,

          revocationReason: 'user_revoked_session',
        },
      });

      if (revoked.count !== 1) {
        return;
      }

      await transaction.refreshToken.updateMany({
        where: {
          sessionId: session.id,

          revokedAt: null,
        },

        data: {
          revokedAt: now,
        },
      });

      await transaction.userActivity.create({
        data: {
          subjectUserId: principal.id,

          actorUserId: principal.id,

          action: 'SESSION_REVOKED',

          resourceType: 'AUTH_SESSION',

          resourceId: session.id,

          description: 'Revoked an authentication session.',

          ipAddress: session.ipAddress,

          userAgent: session.userAgent,
        },
      });
    });
  }

  async logoutAll(principal: AuthPrincipal): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      const sessions = await transaction.authSession.findMany({
        where: {
          userId: principal.id,

          revokedAt: null,
        },

        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
        },
      });

      if (sessions.length === 0) {
        return;
      }

      const sessionIds = sessions.map((session) => session.id);

      const currentSession = sessions.find(
        (session) => session.id === principal.sessionId,
      );

      await transaction.authSession.updateMany({
        where: {
          userId: principal.id,

          revokedAt: null,
        },

        data: {
          revokedAt: now,

          revocationReason: 'logout_all',
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
          subjectUserId: principal.id,

          actorUserId: principal.id,

          action: 'LOGOUT_ALL',

          resourceType: 'USER',

          resourceId: principal.id,

          description: `Logged out ${sessionIds.length} authentication session(s).`,

          ipAddress: currentSession?.ipAddress ?? null,

          userAgent: currentSession?.userAgent ?? null,

          metadata: {
            revokedSessions: sessionIds.length,
          },
        },
      });
    });
  }
}
