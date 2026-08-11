import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@poromosiyo/db';

import type { AuthRole, SessionMetadata } from '../types/auth.types';
import { AuthMailService } from './auth-mail.service';
import { TokenHasherService } from './token-hasher.service';

@Injectable()
export class EmailVerificationService {
  private readonly ttlSeconds: number;

  private readonly cooldownSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tokenHasher: TokenHasherService,
    private readonly mail: AuthMailService,
  ) {
    this.ttlSeconds = this.config.getOrThrow<number>(
      'AUTH_EMAIL_VERIFICATION_TTL_SECONDS',
    );

    this.cooldownSeconds = this.config.getOrThrow<number>(
      'AUTH_EMAIL_ACTION_COOLDOWN_SECONDS',
    );
  }

  async request(
    userId: string,
    expectedRole: AuthRole,
    metadata: SessionMetadata,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        emailVerifiedAt: true,
      },
    });

    if (!user || user.role !== expectedRole || !user.isActive) {
      throw new ForbiddenException(
        'Email verification is unavailable for this account.',
      );
    }

    if (user.emailVerifiedAt) {
      return;
    }

    const now = new Date();

    const latest = await this.prisma.emailVerificationToken.findFirst({
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

    const rawToken = this.tokenHasher.createToken();

    const tokenHash = this.tokenHasher.hashToken(rawToken);

    const expiresAt = new Date(now.getTime() + this.ttlSeconds * 1000);

    const token = await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        email: user.email,
        tokenHash,
        expiresAt,
        requesterIp: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
      select: {
        id: true,
      },
    });

    try {
      await this.mail.sendEmailVerification({
        email: user.email,
        fullName: user.fullName,
        role: expectedRole,
        token: rawToken,
      });
    } catch {
      await this.prisma.emailVerificationToken.deleteMany({
        where: {
          id: token.id,
          usedAt: null,
        },
      });

      throw new ServiceUnavailableException(
        'Email delivery is temporarily unavailable.',
      );
    }

    await this.prisma.emailVerificationToken.updateMany({
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
  }

  async confirm(rawToken: string, expectedRole: AuthRole): Promise<void> {
    const tokenHash = this.tokenHasher.hashToken(rawToken);

    const now = new Date();

    const token = await this.prisma.emailVerificationToken.findUnique({
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
      !token.user.isActive ||
      token.email !== token.user.email
    ) {
      throwInvalidVerificationToken();
    }

    await this.prisma.$transaction(async (transaction) => {
      const claim = await transaction.emailVerificationToken.updateMany({
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
        throwInvalidVerificationToken();
      }

      await transaction.user.update({
        where: {
          id: token.userId,
        },
        data: {
          emailVerifiedAt: now,
        },
      });

      await transaction.emailVerificationToken.updateMany({
        where: {
          userId: token.userId,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });
    });
  }
}

function throwInvalidVerificationToken(): never {
  throw new BadRequestException('Invalid or expired email verification token.');
}
