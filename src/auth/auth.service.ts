import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@poromosiyo/db';

import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { PasswordHasherService } from './services/password-hasher.service';
import { TokenHasherService } from './services/token-hasher.service';
import type {
  AuthenticationResult,
  AuthenticatedUser,
  AuthPrincipal,
  AuthRole,
  SessionMetadata,
} from './types/auth.types';
import { isAuthRole, roleSatisfiesRequirement } from './auth-role.util';

type UserForAuthentication = {
  id: string;
  fullName: string;
  email: string;
  image: string | null;
  passwordHash: string | null;
  role: string;
  isActive: boolean;
  emailVerifiedAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
};

type SessionResult = {
  id: string;
};

@Injectable()
export class AuthService {
  private readonly accessTokenTtlSeconds: number;

  private readonly refreshTokenTtlSeconds: number;

  private readonly maxFailedLoginAttempts: number;

  private readonly accountLockSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokenHasher: TokenHasherService,
  ) {
    this.accessTokenTtlSeconds = this.config.getOrThrow<number>(
      'AUTH_ACCESS_TOKEN_TTL_SECONDS',
    );

    this.refreshTokenTtlSeconds = this.config.getOrThrow<number>(
      'AUTH_REFRESH_TOKEN_TTL_SECONDS',
    );

    this.maxFailedLoginAttempts = this.config.getOrThrow<number>(
      'AUTH_MAX_FAILED_LOGIN_ATTEMPTS',
    );

    this.accountLockSeconds = this.config.getOrThrow<number>(
      'AUTH_ACCOUNT_LOCK_SECONDS',
    );
  }

  async registerCustomer(
    dto: RegisterDto,
    metadata: SessionMetadata,
  ): Promise<AuthenticationResult> {
    const email = normalizeEmail(dto.email);

    const fullName = normalizeFullName(dto.fullName);

    const existing = await this.prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);

    const refreshToken = this.createRefreshToken();

    const now = new Date();

    try {
      const result = await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            fullName,
            email,
            passwordHash,
            passwordChangedAt: now,
            role: 'CUSTOMER',
          },
        });

        const session = await transaction.authSession.create({
          data: {
            userId: user.id,
            userAgent: metadata.userAgent,
            ipAddress: metadata.ipAddress,
            expiresAt: refreshToken.expiresAt,
            refreshTokens: {
              create: {
                tokenHash: refreshToken.hash,
                expiresAt: refreshToken.expiresAt,
              },
            },
          },
          select: {
            id: true,
          },
        });

        return {
          user,
          session,
        };
      });

      return this.createAuthenticationResult(
        result.user,
        result.session,
        refreshToken.raw,
      );
    } catch (error: unknown) {
      if (isPrismaErrorCode(error, 'P2002')) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }

      throw error;
    }
  }

  async loginCustomer(
    dto: LoginDto,
    metadata: SessionMetadata,
  ): Promise<AuthenticationResult> {
    return this.loginForRole(dto, metadata, 'CUSTOMER');
  }

  async loginAdmin(
    dto: LoginDto,
    metadata: SessionMetadata,
  ): Promise<AuthenticationResult> {
    return this.loginForRole(dto, metadata, 'ADMIN');
  }

  async refreshCustomer(
    rawRefreshToken: string,
  ): Promise<AuthenticationResult> {
    return this.refreshForRole(rawRefreshToken, 'CUSTOMER');
  }

  async refreshAdmin(rawRefreshToken: string): Promise<AuthenticationResult> {
    return this.refreshForRole(rawRefreshToken, 'ADMIN');
  }

  async logout(principal: AuthPrincipal): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.authSession.updateMany({
        where: {
          id: principal.sessionId,
          userId: principal.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revocationReason: 'logout',
        },
      }),

      this.prisma.refreshToken.updateMany({
        where: {
          sessionId: principal.sessionId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      }),
    ]);
  }

  private async loginForRole(
    dto: LoginDto,
    metadata: SessionMetadata,
    expectedRole: AuthRole,
  ): Promise<AuthenticationResult> {
    const email = normalizeEmail(dto.email);

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      await this.passwordHasher.verifyOrDummy(null, dto.password);

      throwInvalidCredentials();
    }

    const passwordMatches = await this.passwordHasher.verifyOrDummy(
      user.passwordHash,
      dto.password,
    );

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throwInvalidCredentials();
    }

    if (!passwordMatches) {
      await this.recordFailedLogin(user);

      throwInvalidCredentials();
    }

    if (!roleSatisfiesRequirement(user.role, expectedRole)) {
      throwInvalidCredentials();
    }

    if (!user.isActive) {
      throw new ForbiddenException('This account is disabled.');
    }

    const refreshToken = this.createRefreshToken();

    const now = new Date();

    const result = await this.prisma.$transaction(async (transaction) => {
      const updatedUser = await transaction.user.update({
        where: {
          id: user.id,
        },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: now,
        },
      });

      const session = await transaction.authSession.create({
        data: {
          userId: user.id,
          userAgent: metadata.userAgent,
          ipAddress: metadata.ipAddress,
          expiresAt: refreshToken.expiresAt,
          refreshTokens: {
            create: {
              tokenHash: refreshToken.hash,
              expiresAt: refreshToken.expiresAt,
            },
          },
        },
        select: {
          id: true,
        },
      });

      return {
        user: updatedUser,
        session,
      };
    });

    return this.createAuthenticationResult(
      result.user,
      result.session,
      refreshToken.raw,
    );
  }

  private async refreshForRole(
    rawRefreshToken: string,
    expectedRole: AuthRole,
  ): Promise<AuthenticationResult> {
    const tokenHash = this.tokenHasher.hashToken(rawRefreshToken);

    const now = new Date();

    const rotation = await this.prisma.$transaction(async (transaction) => {
      const storedToken = await transaction.refreshToken.findUnique({
        where: {
          tokenHash,
        },
        include: {
          session: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!storedToken) {
        return {
          status: 'invalid',
        } as const;
      }

      const session = storedToken.session;

      const user = session.user;

      if (storedToken.usedAt !== null) {
        await transaction.authSession.updateMany({
          where: {
            id: session.id,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
            revocationReason: 'refresh_token_reuse',
          },
        });

        await transaction.refreshToken.updateMany({
          where: {
            sessionId: session.id,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
          },
        });

        return {
          status: 'reused',
        } as const;
      }

      if (
        storedToken.revokedAt !== null ||
        storedToken.expiresAt.getTime() <= now.getTime() ||
        session.revokedAt !== null ||
        session.expiresAt.getTime() <= now.getTime() ||
        !user.isActive ||
        !roleSatisfiesRequirement(user.role, expectedRole)
      ) {
        return {
          status: 'invalid',
        } as const;
      }

      const claim = await transaction.refreshToken.updateMany({
        where: {
          id: storedToken.id,
          usedAt: null,
          revokedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          usedAt: now,
        },
      });

      if (claim.count !== 1) {
        await transaction.authSession.updateMany({
          where: {
            id: session.id,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
            revocationReason: 'refresh_token_reuse',
          },
        });

        await transaction.refreshToken.updateMany({
          where: {
            sessionId: session.id,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
          },
        });

        return {
          status: 'reused',
        } as const;
      }

      const nextToken = this.createRefreshToken(session.expiresAt);

      await transaction.refreshToken.create({
        data: {
          sessionId: session.id,
          tokenHash: nextToken.hash,
          expiresAt: nextToken.expiresAt,
        },
      });

      await transaction.authSession.update({
        where: {
          id: session.id,
        },
        data: {
          lastSeenAt: now,
        },
      });

      return {
        status: 'ok',
        user,
        session: {
          id: session.id,
        },
        refreshToken: nextToken.raw,
      } as const;
    });

    if (rotation.status !== 'ok') {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    return this.createAuthenticationResult(
      rotation.user,
      rotation.session,
      rotation.refreshToken,
    );
  }

  private async recordFailedLogin(user: UserForAuthentication): Promise<void> {
    const nextAttempt = user.failedLoginAttempts + 1;

    const shouldLock = nextAttempt >= this.maxFailedLoginAttempts;

    const lockedUntil = shouldLock
      ? new Date(Date.now() + this.accountLockSeconds * 1000)
      : null;

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        failedLoginAttempts: shouldLock ? 0 : nextAttempt,
        lockedUntil,
      },
    });
  }

  private createRefreshToken(absoluteSessionExpiry?: Date): {
    raw: string;
    hash: string;
    expiresAt: Date;
  } {
    const raw = this.tokenHasher.createToken();

    const rollingExpiry = new Date(
      Date.now() + this.refreshTokenTtlSeconds * 1000,
    );

    const expiresAt =
      absoluteSessionExpiry &&
      absoluteSessionExpiry.getTime() < rollingExpiry.getTime()
        ? absoluteSessionExpiry
        : rollingExpiry;

    return {
      raw,
      hash: this.tokenHasher.hashToken(raw),
      expiresAt,
    };
  }

  private async createAuthenticationResult(
    user: UserForAuthentication,
    session: SessionResult,
    refreshToken: string,
  ): Promise<AuthenticationResult> {
    const role = toAuthRole(user.role);

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      sid: session.id,
      role,
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTokenTtlSeconds,
      user: toAuthenticatedUser(user),
    };
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeFullName(fullName: string): string {
  return fullName.trim().replace(/\s+/g, ' ');
}

function toAuthRole(role: string): AuthRole {
  if (isAuthRole(role)) {
    return role;
  }

  throw new Error(`Unsupported authentication role: ${role}`);
}

function toAuthenticatedUser(user: UserForAuthentication): AuthenticatedUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    image: user.image,
    role: toAuthRole(user.role),
    emailVerified: user.emailVerifiedAt !== null,
  };
}

function throwInvalidCredentials(): never {
  throw new UnauthorizedException('Invalid email or password.');
}

function isPrismaErrorCode(error: unknown, code: string): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  const candidate = error as {
    code?: unknown;
  };

  return candidate.code === code;
}
