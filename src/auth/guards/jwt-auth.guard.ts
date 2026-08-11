import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@poromosiyo/db';

import type {
  AuthJwtPayload,
  AuthPrincipal,
  AuthRole,
} from '../types/auth.types';
import type { AuthenticatedRequest } from '../types/authenticated-request.types';
import { isAuthRole } from '../auth-role.util';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throwUnauthorized();
    }

    let payload: AuthJwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<AuthJwtPayload>(token);
    } catch {
      throwUnauthorized();
    }

    validatePayload(payload);

    const session = await this.prisma.authSession.findUnique({
      where: {
        id: payload.sid,
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            image: true,
            role: true,
            isActive: true,
            emailVerifiedAt: true,
          },
        },
      },
    });

    if (!session) {
      throwUnauthorized();
    }

    const now = Date.now();

    if (
      session.userId !== payload.sub ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= now ||
      !session.user.isActive ||
      session.user.role !== payload.role
    ) {
      throwUnauthorized();
    }

    const principal: AuthPrincipal = {
      id: session.user.id,
      sessionId: session.id,
      fullName: session.user.fullName,
      email: session.user.email,
      image: session.user.image,
      role: toAuthRole(session.user.role),
      emailVerified: session.user.emailVerifiedAt !== null,
    };

    request.auth = principal;

    return true;
  }
}

function extractBearerToken(authorization: string | undefined): string | null {
  if (!authorization) {
    return null;
  }

  const parts = authorization.trim().split(/\s+/);

  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer' || !parts[1]) {
    return null;
  }

  return parts[1];
}

function validatePayload(payload: AuthJwtPayload): void {
  if (
    typeof payload.sub !== 'string' ||
    !payload.sub ||
    typeof payload.sid !== 'string' ||
    !payload.sid ||
    !isAuthRole(payload.role)
  ) {
    throwUnauthorized();
  }
}

function isAuthRole(role: unknown): role is AuthRole {
  return role === 'CUSTOMER' || role === 'ADMIN';
}

function toAuthRole(role: string): AuthRole {
  if (isAuthRole(role)) {
    return role;
  }

  throwUnauthorized();
}

function throwUnauthorized(): never {
  throw new UnauthorizedException('Authentication required.');
}
