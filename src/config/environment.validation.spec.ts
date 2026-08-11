import { validateEnvironment } from './environment.validation';

describe('validateEnvironment', () => {
  const validEnvironment = {
    DATABASE_URL: 'mysql://poromosiyo_dev:password@127.0.0.1:3306/poromosiyo',
    AUTH_ACCESS_TOKEN_SECRET: '12345678901234567890123456789012',
  };

  it('applies API defaults', () => {
    const result = validateEnvironment(validEnvironment);

    expect(result.PORT).toBe(3000);

    expect(result.HOST).toBe('127.0.0.1');

    expect(result.AUTH_ACCESS_TOKEN_TTL_SECONDS).toBe(900);

    expect(result.AUTH_REFRESH_TOKEN_TTL_SECONDS).toBe(2592000);

    expect(result.AUTH_MAX_FAILED_LOGIN_ATTEMPTS).toBe(5);

    expect(result.AUTH_ACCOUNT_LOCK_SECONDS).toBe(900);
  });

  it('rejects a missing database URL', () => {
    expect(() =>
      validateEnvironment({
        AUTH_ACCESS_TOKEN_SECRET: validEnvironment.AUTH_ACCESS_TOKEN_SECRET,
      }),
    ).toThrow('DATABASE_URL');
  });

  it('rejects a short access token secret', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: validEnvironment.DATABASE_URL,
        AUTH_ACCESS_TOKEN_SECRET: 'too-short',
      }),
    ).toThrow('AUTH_ACCESS_TOKEN_SECRET');
  });
});
