import {
  ConfigService,
} from '@nestjs/config';

import {
  AuthMailService,
} from './auth-mail.service';

describe('AuthMailService', () => {
  const config =
    new ConfigService({
      NODE_ENV: 'test',
      MAIL_DELIVERY_MODE:
        'memory',
      MAIL_FROM:
        'Poromosiyo <no-reply@example.test>',
      CUSTOMER_APP_URL:
        'http://localhost:4000',
      ADMIN_APP_URL:
        'http://localhost:4001',
    });

  const service =
    new AuthMailService(
      config,
    );

  beforeEach(() => {
    service.clearMemoryMessages();
  });

  it('stores verification tokens only in the test memory transport', async () => {
    await service
      .sendEmailVerification({
        email:
          'customer@example.test',
        fullName:
          'Customer Test',
        role:
          'CUSTOMER',
        token:
          'verification-token-value',
      });

    expect(
      service.getLatestMemoryToken(
        'email_verification',
        'customer@example.test',
      ),
    ).toBe(
      'verification-token-value',
    );
  });

  it('stores password reset tokens only in the test memory transport', async () => {
    await service
      .sendPasswordReset({
        email:
          'admin@example.test',
        fullName:
          'Admin Test',
        role:
          'ADMIN',
        token:
          'password-reset-token',
      });

    expect(
      service.getLatestMemoryToken(
        'password_reset',
        'admin@example.test',
      ),
    ).toBe(
      'password-reset-token',
    );
  });
});
