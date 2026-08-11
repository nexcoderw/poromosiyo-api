import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { roleSatisfiesAnyRequirement } from '../auth-role.util';
import { AUTH_ROLES_METADATA_KEY } from '../auth.constants';
import type { AuthRole } from '../types/auth.types';
import type { AuthenticatedRequest } from '../types/authenticated-request.types';

@Injectable()
export class AuthRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AuthRole[]>(
      AUTH_ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (
      !request.auth ||
      !roleSatisfiesAnyRequirement(request.auth.role, requiredRoles)
    ) {
      throw new ForbiddenException('You do not have access to this resource.');
    }

    return true;
  }
}
