import Joi from 'joi';

const environmentSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),

  HOST: Joi.string().default('127.0.0.1'),

  PORT: Joi.number().integer().min(1).max(65535).default(3000),

  FRONTEND_ALLOWED_ORIGINS: Joi.string().default(
    'http://localhost:4000,http://localhost:4001',
  ),

  DATABASE_URL: Joi.string()
    .uri({
      scheme: ['mysql', 'mariadb'],
    })
    .required(),

  DATABASE_CONNECTION_LIMIT: Joi.number().integer().min(1).default(5),

  DATABASE_CONNECT_ON_INIT: Joi.boolean().default(true),

  AUTH_ACCESS_TOKEN_SECRET: Joi.string().min(32).required(),

  AUTH_ACCESS_TOKEN_TTL_SECONDS: Joi.number().integer().min(60).default(900),

  AUTH_REFRESH_TOKEN_TTL_SECONDS: Joi.number()
    .integer()
    .min(300)
    .default(2592000),

  AUTH_MAX_FAILED_LOGIN_ATTEMPTS: Joi.number()
    .integer()
    .min(1)
    .max(20)
    .default(5),

  AUTH_ACCOUNT_LOCK_SECONDS: Joi.number().integer().min(60).default(900),

  AUTH_EMAIL_VERIFICATION_TTL_SECONDS: Joi.number()
    .integer()
    .min(300)
    .default(86400),

  AUTH_PASSWORD_RESET_TTL_SECONDS: Joi.number()
    .integer()
    .min(300)
    .default(3600),

  AUTH_EMAIL_ACTION_COOLDOWN_SECONDS: Joi.number().integer().min(0).default(60),

  AUTH_RECOVERY_MIN_RESPONSE_MS: Joi.number()
    .integer()
    .min(0)
    .max(5000)
    .default(500),

  CUSTOMER_APP_URL: Joi.string().uri().default('http://localhost:4000'),

  ADMIN_APP_URL: Joi.string().uri().default('http://localhost:4001'),

  MAIL_DELIVERY_MODE: Joi.string().valid('memory', 'smtp').default('memory'),

  MAIL_FROM: Joi.string().default('Poromosiyo <no-reply@poromosiyo.local>'),

  SMTP_HOST: Joi.string().allow('').default(''),

  SMTP_PORT: Joi.number().integer().min(1).max(65535).default(587),

  SMTP_SECURE: Joi.boolean().default(false),

  SMTP_USER: Joi.string().allow('').default(''),

  SMTP_PASSWORD: Joi.string().allow('').default(''),

  GOOGLE_AUTH_ENABLED: Joi.boolean().default(false),

  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),

  GCS_IMAGE_BUCKET: Joi.string().trim().default('poromosiyo-images'),
}).unknown(true);

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const result = environmentSchema.validate(config, {
    abortEarly: false,
    convert: true,
  });

  if (result.error) {
    throw new Error(
      `Environment validation failed: ${result.error.details
        .map((detail) => detail.message)
        .join('; ')}`,
    );
  }

  const value = result.value as Record<string, unknown>;

  const environment = value.NODE_ENV;

  const mailMode = value.MAIL_DELIVERY_MODE;

  if (
    (environment === 'staging' || environment === 'production') &&
    mailMode !== 'smtp'
  ) {
    throw new Error(
      'Environment validation failed: MAIL_DELIVERY_MODE must be smtp outside development/test.',
    );
  }

  if (
    mailMode === 'smtp' &&
    (typeof value.SMTP_HOST !== 'string' || !value.SMTP_HOST)
  ) {
    throw new Error(
      'Environment validation failed: SMTP_HOST is required when MAIL_DELIVERY_MODE is smtp.',
    );
  }

  if (
    value.GOOGLE_AUTH_ENABLED === true &&
    (typeof value.GOOGLE_CLIENT_ID !== 'string' ||
      !value.GOOGLE_CLIENT_ID.trim())
  ) {
    throw new Error(
      'Environment validation failed: GOOGLE_CLIENT_ID is required when GOOGLE_AUTH_ENABLED is true.',
    );
  }

  return value;
}
