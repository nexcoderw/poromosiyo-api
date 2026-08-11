import type { Request } from 'express';

import type { AuthPrincipal } from './auth.types';

export type AuthenticatedRequest = Request & {
  auth: AuthPrincipal;
};
