import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

import { AUTH_ROLES_METADATA_KEY } from '../auth.constants';
import type { AuthRole } from '../types/auth.types';

export const RequireAuthRoles = (...roles: AuthRole[]) =>
  applyDecorators(
    SetMetadata(AUTH_ROLES_METADATA_KEY, roles),
    ApiBearerAuth('access-token'),
  );
