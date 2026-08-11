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

  GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),

  GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),

  GOOGLE_REDIRECT_URI: Joi.string().uri().allow('').optional(),
}).unknown(true);

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const result = environmentSchema.validate(config, {
    abortEarly: false,
    convert: true,
  });

  if (result.error) {
    const message = result.error.details
      .map((detail) => detail.message)
      .join('; ');

    throw new Error(`Environment validation failed: ${message}`);
  }

  return result.value as Record<string, unknown>;
}
