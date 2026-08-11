import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@poromosiyo/db';

import type {
  AuthPrincipal,
  AuthRole,
  SessionMetadata,
} from '../types/auth.types';
import { AuthMailService } from './auth-mail.service';
import { PasswordHasherService } from './password-hasher.service';
import { TokenHasherService } from './token-hasher.service';

@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  private readonly resetTtlSeconds: number;

  private readonly cooldownSeconds: number;

  private readonly minimumResponseMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tokenHasher: TokenHasherService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly mail: AuthMailService,
  ) {
    this.resetTtlSeconds = this.config.getOrThrow<number>(
      'AUTH_PASSWORD_RESET_TTL_SECONDS',
    );

    this.cooldownSeconds = this.config.getOrThrow<number>(
      'AUTH_EMAIL_ACTION_COOLDOWN_SECONDS',
    );

    this.minimumResponseMs = this.config.getOrThrow<number>(
      'AUTH_RECOVERY_MIN_RESPONSE_MS',
    );
  }

  async requestReset(
    emailInput: string,
    expectedRole: AuthRole,
    metadata: SessionMetadata,
  ): Promise<void> {
    const startedAt = Date.now();

    const email = normalizeEmail(emailInput);

    const rawToken = this.tokenHasher.createToken();

    const tokenHash = this.tokenHasher.hashToken(rawToken);

    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
        },
      });

      if (!user || user.role !== expectedRole || !user.isActive) {
        return;
      }

      const now = new Date();

      const latest = await this.prisma.passwordResetToken.findFirst({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          createdAt: true,
        },
      });

      if (
        latest &&
        latest.createdAt.getTime() > now.getTime() - this.cooldownSeconds * 1000
      ) {
        return;
      }

      const token = await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(now.getTime() + this.resetTtlSeconds * 1000),
          requesterIp: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
        select: {
          id: true,
        },
      });

      try {
        await this.mail.sendPasswordReset({
          email: user.email,
          fullName: user.fullName,
          role: expectedRole,
          token: rawToken,
        });

        await this.prisma.passwordResetToken.updateMany({
          where: {
            userId: user.id,
            id: {
              not: token.id,
            },
            usedAt: null,
          },
          data: {
            usedAt: new Date(),
          },
        });
      } catch {
        await this.prisma.passwordResetToken.deleteMany({
          where: {
            id: token.id,
            usedAt: null,
          },
        });

        this.logger.error('Password reset email delivery failed.');
      }
    } finally {
      await waitForMinimumDuration(startedAt, this.minimumResponseMs);
    }
  }

  async resetPassword(
    rawToken: string,
    newPassword: string,
    confirmPassword: string,
    expectedRole: AuthRole,
  ): Promise<void> {
    assertMatchingPasswords(newPassword, confirmPassword);

    const tokenHash = this.tokenHasher.hashToken(rawToken);

    const now = new Date();

    const token = await this.prisma.passwordResetToken.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: true,
      },
    });

    if (
      !token ||
      token.usedAt !== null ||
      token.expiresAt.getTime() <= now.getTime() ||
      token.user.role !== expectedRole ||
      !token.user.isActive
    ) {
      throwInvalidResetToken();
    }

    if (token.user.passwordHash) {
      const samePassword = await this.passwordHasher.verify(
        token.user.passwordHash,
        newPassword,
      );

      if (samePassword) {
        throw new BadRequestException(
          'The new password must be different from the current password.',
        );
      }
    }

    const passwordHash = await this.passwordHasher.hash(newPassword);

    await this.prisma.$transaction(async (transaction) => {
      const claim = await transaction.passwordResetToken.updateMany({
        where: {
          id: token.id,
          usedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          usedAt: now,
        },
      });

      if (claim.count !== 1) {
        throwInvalidResetToken();
      }

      const sessions = await transaction.authSession.findMany({
        where: {
          userId: token.userId,
          revokedAt: null,
        },
        select: {
          id: true,
        },
      });

      const sessionIds = sessions.map((session) => session.id);

      await transaction.user.update({
        where: {
          id: token.userId,
        },
        data: {
          passwordHash,
          passwordChangedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      await transaction.passwordResetToken.updateMany({
        where: {
          userId: token.userId,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      await transaction.authSession.updateMany({
        where: {
          userId: token.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revocationReason: 'password_reset',
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

    await this.sendPasswordChangedBestEffort(
      token.user.email,
      token.user.fullName,
    );
  }

  async changePassword(
    principal: AuthPrincipal,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<void> {
    assertMatchingPasswords(newPassword, confirmPassword);

    const user = await this.prisma.user.findUnique({
      where: {
        id: principal.id,
      },
    });

    if (!user || user.role !== principal.role || !user.isActive) {
      throw new UnauthorizedException('Authentication required.');
    }

    const currentMatches = await this.passwordHasher.verifyOrDummy(
      user.passwordHash,
      currentPassword,
    );

    if (!currentMatches) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    if (
      user.passwordHash &&
      (await this.passwordHasher.verify(user.passwordHash, newPassword))
    ) {
      throw new BadRequestException(
        'The new password must be different from the current password.',
      );
    }

    const passwordHash = await this.passwordHasher.hash(newPassword);

    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      const sessions = await transaction.authSession.findMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        select: {
          id: true,
        },
      });

      const sessionIds = sessions.map((session) => session.id);

      await transaction.user.update({
        where: {
          id: user.id,
        },
        data: {
          passwordHash,
          passwordChangedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      await transaction.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      await transaction.authSession.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revocationReason: 'password_change',
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

    await this.sendPasswordChangedBestEffort(user.email, user.fullName);
  }

  private async sendPasswordChangedBestEffort(
    email: string,
    fullName: string,
  ): Promise<void> {
    try {
      await this.mail.sendPasswordChanged({
        email,
        fullName,
      });
    } catch {
      this.logger.error('Password change notification delivery failed.');
    }
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertMatchingPasswords(password: string, confirmation: string): void {
  if (password !== confirmation) {
    throw new BadRequestException('Password confirmation does not match.');
  }
}

function throwInvalidResetToken(): never {
  throw new BadRequestException('Invalid or expired password reset token.');
}

async function waitForMinimumDuration(
  startedAt: number,
  minimumMs: number,
): Promise<void> {
  const elapsed = Date.now() - startedAt;

  const remaining = minimumMs - elapsed;

  if (remaining <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, remaining);
  });
}
