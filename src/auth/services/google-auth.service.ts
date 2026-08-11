import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ConfigService,
} from '@nestjs/config';
import {
  JwtService,
} from '@nestjs/jwt';
import {
  PrismaService,
} from '@poromosiyo/db';

import type {
  AuthenticationResult,
  AuthenticatedUser,
  AuthPrincipal,
  AuthRole,
  SessionMetadata,
} from '../types/auth.types';
import type {
  VerifiedGoogleIdentity,
} from '../types/google-auth.types';
import {
  GoogleIdTokenVerifierService,
} from './google-id-token-verifier.service';
import {
  TokenHasherService,
} from './token-hasher.service';

type GoogleAuthUser = {
  id: string;
  fullName: string;
  email: string;
  image: string | null;
  role: string;
  isActive: boolean;
  emailVerifiedAt: Date | null;
};

@Injectable()
export class GoogleAuthService {
  private readonly accessTokenTtlSeconds:
    number;

  private readonly refreshTokenTtlSeconds:
    number;

  constructor(
    private readonly prisma:
      PrismaService,
    private readonly jwtService:
      JwtService,
    private readonly config:
      ConfigService,
    private readonly verifier:
      GoogleIdTokenVerifierService,
    private readonly tokenHasher:
      TokenHasherService,
  ) {
    this.accessTokenTtlSeconds =
      this.config.getOrThrow<number>(
        'AUTH_ACCESS_TOKEN_TTL_SECONDS',
      );

    this.refreshTokenTtlSeconds =
      this.config.getOrThrow<number>(
        'AUTH_REFRESH_TOKEN_TTL_SECONDS',
      );
  }

  async loginCustomer(
    idToken: string,
    metadata: SessionMetadata,
  ): Promise<AuthenticationResult> {
    const identity =
      await this.verifier.verify(
        idToken,
      );

    const linked =
      await this.findGoogleAccount(
        identity.subject,
      );

    if (linked) {
      return this.authenticateLinkedUser(
        linked.user,
        'CUSTOMER',
        metadata,
      );
    }

    const existingUser =
      await this.prisma
        .user
        .findUnique({
          where: {
            email:
              identity.email,
          },
          select: {
            id: true,
          },
        });

    if (existingUser) {
      throw new ConflictException(
        'An account with this email already exists. Sign in first and link Google.',
      );
    }

    if (
      !identity.emailAuthoritative
    ) {
      throw new ForbiddenException(
        'Automatic Google registration is unavailable for this email. Register with email and password first, then link Google.',
      );
    }

    try {
      return await this
        .createGoogleCustomer(
          identity,
          metadata,
        );
    } catch (
      error: unknown
    ) {
      if (
        !isPrismaErrorCode(
          error,
          'P2002',
        )
      ) {
        throw error;
      }

      const accountAfterRace =
        await this
          .findGoogleAccount(
            identity.subject,
          );

      if (accountAfterRace) {
        return this
          .authenticateLinkedUser(
            accountAfterRace.user,
            'CUSTOMER',
            metadata,
          );
      }

      throw new ConflictException(
        'An account with this email already exists. Sign in first and link Google.',
      );
    }
  }

  async loginAdmin(
    idToken: string,
    metadata: SessionMetadata,
  ): Promise<AuthenticationResult> {
    const identity =
      await this.verifier.verify(
        idToken,
      );

    const linked =
      await this.findGoogleAccount(
        identity.subject,
      );

    if (!linked) {
      throwInvalidGoogleLogin();
    }

    return this.authenticateLinkedUser(
      linked.user,
      'ADMIN',
      metadata,
    );
  }

  async linkCustomer(
    principal: AuthPrincipal,
    idToken: string,
  ): Promise<void> {
    await this.linkGoogleAccount(
      principal,
      idToken,
      'CUSTOMER',
    );
  }

  async linkAdmin(
    principal: AuthPrincipal,
    idToken: string,
  ): Promise<void> {
    await this.linkGoogleAccount(
      principal,
      idToken,
      'ADMIN',
    );
  }

  private async linkGoogleAccount(
    principal: AuthPrincipal,
    idToken: string,
    expectedRole: AuthRole,
  ): Promise<void> {
    if (
      principal.role !==
      expectedRole
    ) {
      throw new ForbiddenException(
        'You do not have access to this resource.',
      );
    }

    const identity =
      await this.verifier.verify(
        idToken,
      );

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
            email: true,
            role: true,
            isActive: true,
            emailVerifiedAt:
              true,
          },
        });

    if (
      !user ||
      !user.isActive ||
      toAuthRole(
        user.role,
      ) !== expectedRole
    ) {
      throw new UnauthorizedException(
        'Authentication required.',
      );
    }

    const accountBySubject =
      await this.prisma
        .authAccount
        .findFirst({
          where: {
            provider:
              'GOOGLE',
            providerAccountId:
              identity.subject,
          },
          select: {
            userId: true,
          },
        });

    if (accountBySubject) {
      if (
        accountBySubject.userId ===
        user.id
      ) {
        await this
          .verifyEmailFromGoogleWhenAuthoritative(
            user,
            identity,
          );

        return;
      }

      throw new ConflictException(
        'This Google account is already linked to another Poromosiyo account.',
      );
    }

    if (
      normalizeEmail(
        identity.email,
      ) !==
      normalizeEmail(
        user.email,
      )
    ) {
      throw new ConflictException(
        'The Google account email must match your Poromosiyo account email.',
      );
    }

    const existingProvider =
      await this.prisma
        .authAccount
        .findFirst({
          where: {
            userId:
              user.id,
            provider:
              'GOOGLE',
          },
          select: {
            id: true,
          },
        });

    if (existingProvider) {
      throw new ConflictException(
        'A Google account is already linked to this Poromosiyo account.',
      );
    }

    try {
      await this.prisma
        .$transaction(
          async (
            transaction,
          ) => {
            await transaction
              .authAccount
              .create({
                data: {
                  userId:
                    user.id,
                  provider:
                    'GOOGLE',
                  providerAccountId:
                    identity.subject,
                },
              });

            if (
              identity
                .emailAuthoritative &&
              user.emailVerifiedAt ===
                null
            ) {
              await transaction
                .user
                .update({
                  where: {
                    id:
                      user.id,
                  },
                  data: {
                    emailVerifiedAt:
                      new Date(),
                  },
                });
            }
          },
        );
    } catch (
      error: unknown
    ) {
      if (
        isPrismaErrorCode(
          error,
          'P2002',
        )
      ) {
        throw new ConflictException(
          'This Google account cannot be linked.',
        );
      }

      throw error;
    }
  }

  private async createGoogleCustomer(
    identity:
      VerifiedGoogleIdentity,
    metadata:
      SessionMetadata,
  ): Promise<AuthenticationResult> {
    const now =
      new Date();

    const token =
      this.createRefreshToken();

    const result =
      await this.prisma
        .$transaction(
          async (
            transaction,
          ) => {
            const user =
              await transaction
                .user
                .create({
                  data: {
                    fullName:
                      identity.fullName,
                    email:
                      identity.email,
                    image:
                      identity.image,
                    passwordHash:
                      null,
                    role:
                      'CUSTOMER',
                    isActive:
                      true,
                    emailVerifiedAt:
                      now,
                    passwordChangedAt:
                      null,
                    lastLoginAt:
                      now,
                    accounts: {
                      create: {
                        provider:
                          'GOOGLE',
                        providerAccountId:
                          identity.subject,
                      },
                    },
                  },
                });

            const session =
              await transaction
                .authSession
                .create({
                  data: {
                    userId:
                      user.id,
                    userAgent:
                      metadata.userAgent,
                    ipAddress:
                      metadata.ipAddress,
                    expiresAt:
                      token.expiresAt,
                    refreshTokens: {
                      create: {
                        tokenHash:
                          token.hash,
                        expiresAt:
                          token.expiresAt,
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
          },
        );

    return this
      .createAuthenticationResult(
        result.user,
        result.session.id,
        token.raw,
      );
  }

  private async authenticateLinkedUser(
    user: GoogleAuthUser,
    expectedRole: AuthRole,
    metadata: SessionMetadata,
  ): Promise<AuthenticationResult> {
    if (
      !user.isActive ||
      toAuthRole(
        user.role,
      ) !== expectedRole
    ) {
      throwInvalidGoogleLogin();
    }

    const token =
      this.createRefreshToken();

    const now =
      new Date();

    const result =
      await this.prisma
        .$transaction(
          async (
            transaction,
          ) => {
            const updatedUser =
              await transaction
                .user
                .update({
                  where: {
                    id:
                      user.id,
                  },
                  data: {
                    lastLoginAt:
                      now,
                    failedLoginAttempts:
                      0,
                    lockedUntil:
                      null,
                  },
                });

            const session =
              await transaction
                .authSession
                .create({
                  data: {
                    userId:
                      user.id,
                    userAgent:
                      metadata.userAgent,
                    ipAddress:
                      metadata.ipAddress,
                    expiresAt:
                      token.expiresAt,
                    refreshTokens: {
                      create: {
                        tokenHash:
                          token.hash,
                        expiresAt:
                          token.expiresAt,
                      },
                    },
                  },
                  select: {
                    id: true,
                  },
                });

            return {
              user:
                updatedUser,
              session,
            };
          },
        );

    return this
      .createAuthenticationResult(
        result.user,
        result.session.id,
        token.raw,
      );
  }

  private async findGoogleAccount(
    subject: string,
  ) {
    return this.prisma
      .authAccount
      .findFirst({
        where: {
          provider:
            'GOOGLE',
          providerAccountId:
            subject,
        },
        include: {
          user: true,
        },
      });
  }

  private async verifyEmailFromGoogleWhenAuthoritative(
    user: {
      id: string;
      email: string;
      emailVerifiedAt:
        Date | null;
    },
    identity:
      VerifiedGoogleIdentity,
  ): Promise<void> {
    if (
      user.emailVerifiedAt !==
        null ||
      !identity.emailAuthoritative ||
      normalizeEmail(
        user.email,
      ) !==
        normalizeEmail(
          identity.email,
        )
    ) {
      return;
    }

    await this.prisma
      .user
      .update({
        where: {
          id:
            user.id,
        },
        data: {
          emailVerifiedAt:
            new Date(),
        },
      });
  }

  private createRefreshToken(): {
    raw: string;
    hash: string;
    expiresAt: Date;
  } {
    const raw =
      this.tokenHasher
        .createToken();

    return {
      raw,
      hash:
        this.tokenHasher
          .hashToken(raw),
      expiresAt:
        new Date(
          Date.now() +
            this
              .refreshTokenTtlSeconds *
              1000,
        ),
    };
  }

  private async createAuthenticationResult(
    user: GoogleAuthUser,
    sessionId: string,
    refreshToken: string,
  ): Promise<AuthenticationResult> {
    const role =
      toAuthRole(
        user.role,
      );

    const accessToken =
      await this.jwtService
        .signAsync({
          sub:
            user.id,
          sid:
            sessionId,
          role,
        });

    return {
      accessToken,
      refreshToken,
      tokenType:
        'Bearer',
      expiresIn:
        this
          .accessTokenTtlSeconds,
      user:
        toAuthenticatedUser(
          user,
        ),
    };
  }
}

function normalizeEmail(
  email: string,
): string {
  return email
    .trim()
    .toLowerCase();
}

function toAuthRole(
  role: string,
): AuthRole {
  if (
    role === 'CUSTOMER' ||
    role === 'ADMIN'
  ) {
    return role;
  }

  throw new Error(
    `Unsupported authentication role: ${role}`,
  );
}

function toAuthenticatedUser(
  user: GoogleAuthUser,
): AuthenticatedUser {
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
      toAuthRole(
        user.role,
      ),
    emailVerified:
      user.emailVerifiedAt !==
      null,
  };
}

function throwInvalidGoogleLogin(): never {
  throw new UnauthorizedException(
    'Google authentication failed.',
  );
}

function isPrismaErrorCode(
  error: unknown,
  code: string,
): boolean {
  if (
    typeof error !==
      'object' ||
    error === null ||
    !('code' in error)
  ) {
    return false;
  }

  return (
    error as {
      code?: unknown;
    }
  ).code === code;
}
