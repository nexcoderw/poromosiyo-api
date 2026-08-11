export const AUTH_PASSWORD_MIN_LENGTH = 12;
export const AUTH_PASSWORD_MAX_LENGTH = 128;

export const AUTH_LOGIN_RATE_LIMIT = 5;
export const AUTH_LOGIN_RATE_WINDOW_MS = 60_000;

export const AUTH_REGISTER_RATE_LIMIT = 5;
export const AUTH_REGISTER_RATE_WINDOW_MS = 60_000;

export const AUTH_REFRESH_RATE_LIMIT = 10;
export const AUTH_REFRESH_RATE_WINDOW_MS = 60_000;

export const AUTH_EMAIL_ACTION_RATE_LIMIT = 5;
export const AUTH_EMAIL_ACTION_RATE_WINDOW_MS = 15 * 60_000;

export const AUTH_PASSWORD_RECOVERY_RATE_LIMIT = 5;
export const AUTH_PASSWORD_RECOVERY_RATE_WINDOW_MS =
  15 * 60_000;

export const USER_FULL_NAME_MAX_LENGTH = 150;
export const USER_EMAIL_MAX_LENGTH = 254;
export const USER_AGENT_MAX_LENGTH = 255;
export const IP_ADDRESS_MAX_LENGTH = 45;

export const AUTH_ROLES_METADATA_KEY =
  'poromosiyo:auth:roles';

export const PASSWORD_RESET_REQUEST_MESSAGE =
  'If an eligible account exists, password reset instructions have been sent.';

export const EMAIL_VERIFICATION_REQUEST_MESSAGE =
  'If email verification is required, verification instructions have been sent.';
