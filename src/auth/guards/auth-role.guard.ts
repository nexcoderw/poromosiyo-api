import {
  CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  Reflector,
} from '@nestjs/core';

import {
  AUTH_ROLES_METADATA_KEY,
} from '../auth.constants';
import type {
  AuthRole,
} from '../types/auth.types';
import type {
  AuthenticatedRequest,
} from '../types/authenticated-request.types';

@Injectable()
export class AuthRoleGuard
  implements CanActivate
{
  constructor(
    private readonly reflector:
      Reflector,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean {
    const roles =
      this.reflector
        .getAllAndOverride<
          AuthRole[]
        >(
          AUTH_ROLES_METADATA_KEY,
          [
            context.getHandler(),
            context.getClass(),
          ],
        );

    if (
      !roles ||
      roles.length === 0
    ) {
      return true;
    }

    const request =
      context
        .switchToHttp()
        .getRequest<
          AuthenticatedRequest
        >();

    if (
      !request.auth ||
      !roles.includes(
        request.auth.role,
      )
    ) {
      throw new ForbiddenException(
        'You do not have access to this resource.',
      );
    }

    return true;
  }
}
