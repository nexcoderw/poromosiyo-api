import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  PrismaService,
} from '@poromosiyo/db';

import type {
  AuthenticationMethods,
} from '../types/auth-management.types';
import type {
  AuthPrincipal,
} from '../types/auth.types';
import {
  PasswordHasherService,
} from './password-hasher.service';

@Injectable()
export class AuthMethodManagementService {
  constructor(
    private readonly prisma:
      PrismaService,
    private readonly passwordHasher:
      PasswordHasherService,
  ) {}

  async getMethods(
    principal: AuthPrincipal,
  ): Promise<AuthenticationMethods> {
    const user =
      await this.getUser(
        principal,
      );

    return {
      password:
        user.passwordHash !==
        null,
      google:
        user.accounts.length >
        0,
    };
  }

  async unlinkGoogle(
    principal: AuthPrincipal,
    currentPassword: string,
  ): Promise<void> {
    const user =
      await this.getUser(
        principal,
      );

    const googleAccount =
      user.accounts[0];

    if (!googleAccount) {
      return;
    }

    if (
      user.passwordHash ===
      null
    ) {
      throw new ConflictException(
        'Set a local password before unlinking Google.',
      );
    }

    const passwordMatches =
      await this.passwordHasher
        .verify(
          user.passwordHash,
          currentPassword,
        );

    if (!passwordMatches) {
      throw new UnauthorizedException(
        'Current password is incorrect.',
      );
    }

    await this.prisma
      .authAccount
      .deleteMany({
        where: {
          userId:
            user.id,
          provider:
            'GOOGLE',
        },
      });
  }

  private async getUser(
    principal: AuthPrincipal,
  ) {
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
            accounts: {
              where: {
                provider:
                  'GOOGLE',
              },
              select: {
                id:
                  true,
              },
            },
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

    return user;
  }
}
