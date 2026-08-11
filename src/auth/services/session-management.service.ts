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
      },
    });

    if (!session) {
      throw new NotFoundException('Authentication session not found.');
    }

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.authSession.updateMany({
        where: {
          id: session.id,
          userId: principal.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revocationReason: 'user_revoked_session',
        },
      }),

      this.prisma.refreshToken.updateMany({
        where: {
          sessionId: session.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      }),
    ]);
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
        },
      });

      const sessionIds = sessions.map((session) => session.id);

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

      if (sessionIds.length > 0) {
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
      }
    });
  }
}
