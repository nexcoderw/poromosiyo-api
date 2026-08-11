import type { Request } from 'express';

import { IP_ADDRESS_MAX_LENGTH, USER_AGENT_MAX_LENGTH } from './auth.constants';
import type { SessionMetadata } from './types/auth.types';

export function getSessionMetadata(request: Request): SessionMetadata {
  return {
    ipAddress: truncate(request.ip ?? null, IP_ADDRESS_MAX_LENGTH),
    userAgent: truncate(
      request.get('user-agent') ?? null,
      USER_AGENT_MAX_LENGTH,
    ),
  };
}

function truncate(value: string | null, maxLength: number): string | null {
  if (!value) {
    return null;
  }

  return value.slice(0, maxLength);
}
