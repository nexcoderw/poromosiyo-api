import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  PrismaService,
} from '@poromosiyo/db';

import type {
  AuthPrincipal,
} from '../types/auth.types';
import {
  PasswordHasherService,
} from './password-hasher.service';

@Injectable()
export class LocalPasswordService {
  constructor(
    private readonly prisma:
      PrismaService,
    private readonly passwordHasher:
      PasswordHasherService,
  ) {}

  async setPassword(
    principal: AuthPrincipal,
    newPassword: string,
    confirmPassword: string,
  ): Promise<void> {
    if (
      newPassword !==
      confirmPassword
    ) {
      throw new BadRequestException(
        'Password confirmation does not match.',
      );
    }

    const user =
      await this.prisma
        .user
        .findUnique({
          where: {
            id:
              principal.id,
          },
          select: {
            id: true,
            role: true,
            isActive:
              true,
            passwordHash:
              true,
          },
        });

    if (
      !user ||
      !user.isActive ||
      user.role !==
        principal.role
    ) {
      throw new UnauthorizedException(
        'Authentication required.',
      );
    }

    if (
      user.passwordHash !==
      null
    ) {
      throw new ConflictException(
        'A local password already exists. Use change-password instead.',
      );
    }

    const passwordHash =
      await this.passwordHasher
        .hash(
          newPassword,
        );

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
                    user.id,
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

          const updated =
            await transaction
              .user
              .updateMany({
                where: {
                  id:
                    user.id,
                  passwordHash:
                    null,
                },
                data: {
                  passwordHash,
                  passwordChangedAt:
                    now,
                  failedLoginAttempts:
                    0,
                  lockedUntil:
                    null,
                },
              });

          if (
            updated.count !==
            1
          ) {
            throw new ConflictException(
              'A local password already exists.',
            );
          }

          await transaction
            .passwordResetToken
            .updateMany({
              where: {
                userId:
                  user.id,
                usedAt:
                  null,
              },
              data: {
                usedAt:
                  now,
              },
            });

          await transaction
            .authSession
            .updateMany({
              where: {
                userId:
                  user.id,
                revokedAt:
                  null,
              },
              data: {
                revokedAt:
                  now,
                revocationReason:
                  'local_password_set',
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
        },
      );
  }
}
