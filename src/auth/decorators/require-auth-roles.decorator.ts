import {
  SetMetadata,
} from '@nestjs/common';

import {
  AUTH_ROLES_METADATA_KEY,
} from '../auth.constants';
import type {
  AuthRole,
} from '../types/auth.types';

export const RequireAuthRoles = (
  ...roles: AuthRole[]
) =>
  SetMetadata(
    AUTH_ROLES_METADATA_KEY,
    roles,
  );
