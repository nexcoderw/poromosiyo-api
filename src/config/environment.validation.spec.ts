import { validateEnvironment } from './environment.validation';

describe('validateEnvironment', () => {
  const validEnvironment = {
    DATABASE_URL: 'mysql://poromosiyo_dev:password@127.0.0.1:3306/poromosiyo',
    AUTH_ACCESS_TOKEN_SECRET: '12345678901234567890123456789012',
  };

  it('applies authentication defaults', () => {
    const result = validateEnvironment(validEnvironment);

    expect(result.PORT).toBe(3000);

    expect(result.AUTH_EMAIL_VERIFICATION_TTL_SECONDS).toBe(86400);

    expect(result.AUTH_PASSWORD_RESET_TTL_SECONDS).toBe(3600);

    expect(result.GOOGLE_AUTH_ENABLED).toBe(false);

    expect(result.GOOGLE_CLIENT_ID).toBe('');
  });

  it('requires Google client ID when Google auth is enabled', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        GOOGLE_AUTH_ENABLED: true,
        GOOGLE_CLIENT_ID: '',
      }),
    ).toThrow('GOOGLE_CLIENT_ID');
  });

  it('accepts configured Google authentication', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        GOOGLE_AUTH_ENABLED: true,
        GOOGLE_CLIENT_ID: '123456789-example.apps.googleusercontent.com',
      }),
    ).not.toThrow();
  });

  it('rejects production memory email delivery', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        MAIL_DELIVERY_MODE: 'memory',
      }),
    ).toThrow('MAIL_DELIVERY_MODE');
  });

  it('requires an SMTP host in SMTP mode', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        MAIL_DELIVERY_MODE: 'smtp',
        SMTP_HOST: '',
      }),
    ).toThrow('SMTP_HOST');
  });
});
