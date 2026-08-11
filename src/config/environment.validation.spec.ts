import {
  validateEnvironment,
} from './environment.validation';

describe('validateEnvironment', () => {
  const validEnvironment = {
    DATABASE_URL:
      'mysql://poromosiyo_dev:password@127.0.0.1:3306/poromosiyo',
    AUTH_ACCESS_TOKEN_SECRET:
      '12345678901234567890123456789012',
  };

  it('applies authentication and mail defaults', () => {
    const result =
      validateEnvironment(
        validEnvironment,
      );

    expect(result.PORT)
      .toBe(3000);

    expect(
      result.AUTH_EMAIL_VERIFICATION_TTL_SECONDS,
    ).toBe(86400);

    expect(
      result.AUTH_PASSWORD_RESET_TTL_SECONDS,
    ).toBe(3600);

    expect(
      result.AUTH_EMAIL_ACTION_COOLDOWN_SECONDS,
    ).toBe(60);

    expect(
      result.AUTH_RECOVERY_MIN_RESPONSE_MS,
    ).toBe(500);

    expect(
      result.MAIL_DELIVERY_MODE,
    ).toBe('memory');
  });

  it('rejects production memory email delivery', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV:
          'production',
        MAIL_DELIVERY_MODE:
          'memory',
      }),
    ).toThrow(
      'MAIL_DELIVERY_MODE',
    );
  });

  it('requires an SMTP host in SMTP mode', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        MAIL_DELIVERY_MODE:
          'smtp',
        SMTP_HOST: '',
      }),
    ).toThrow(
      'SMTP_HOST',
    );
  });
});
