import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

import type { AuthPrincipal } from '../types/auth.types';
import type { AuthenticatedRequest } from '../types/authenticated-request.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPrincipal => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.auth) {
      throw new UnauthorizedException('Authentication required.');
    }

    return request.auth;
  },
);
