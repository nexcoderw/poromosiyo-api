import {
  type INestApplication,
} from '@nestjs/common';
import {
  Test,
  type TestingModule,
} from '@nestjs/testing';
import {
  PrismaService,
} from '@poromosiyo/db';
import request from 'supertest';

import {
  AppModule,
} from '../src/app.module';
import {
  PasswordHasherService,
} from '../src/auth/services/password-hasher.service';
import type {
  AuthenticationResult,
} from '../src/auth/types/auth.types';
import {
  configureApplication,
} from '../src/bootstrap/configure-application';

describe('Poromosiyo session authentication (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix =
    `${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;

  const customerEmail =
    `phase8-customer-${suffix}@example.test`;

  const adminEmail =
    `phase8-admin-${suffix}@example.test`;

  const customerPassword =
    'Poromosiyo-Phase8-Customer-123!';

  const adminPassword =
    'Poromosiyo-Phase8-Admin-123!';

  let customerRegistration:
    AuthenticationResult | null =
      null;

  let customerRefresh:
    AuthenticationResult | null =
      null;

  let customerLogin:
    AuthenticationResult | null =
      null;

  let adminLogin:
    AuthenticationResult | null =
      null;

  beforeAll(async () => {
    const moduleFixture:
      TestingModule =
      await Test
        .createTestingModule({
          imports: [
            AppModule,
          ],
        })
        .compile();

    app =
      moduleFixture
        .createNestApplication();

    configureApplication(app);

    await app.init();

    prisma =
      app.get(PrismaService);

    const passwordHasher =
      app.get(
        PasswordHasherService,
      );

    await prisma
      .user
      .deleteMany({
        where: {
          email: {
            in: [
              customerEmail,
              adminEmail,
            ],
          },
        },
      });

    const adminPasswordHash =
      await passwordHasher
        .hash(adminPassword);

    await prisma
      .user
      .create({
        data: {
          fullName:
            'Phase Eight Admin',
          email:
            adminEmail,
          passwordHash:
            adminPasswordHash,
          passwordChangedAt:
            new Date(),
          role:
            'ADMIN',
        },
      });
  });

  afterAll(async () => {
    await prisma
      .user
      .deleteMany({
        where: {
          email: {
            in: [
              customerEmail,
              adminEmail,
            ],
          },
        },
      });

    await app.close();
  });

  it('registers a customer', async () => {
    const response =
      await request(
        app.getHttpServer(),
      )
        .post(
          '/api/v1/auth/register',
        )
        .send({
          fullName:
            'Phase Eight Customer',
          email:
            customerEmail,
          password:
            customerPassword,
        })
        .expect(201);

    customerRegistration =
      parseAuthenticationResult(
        response.text,
      );
  });

  it('returns the authenticated customer from /auth/me', async () => {
    const auth =
      requireAuth(
        customerRegistration,
      );

    const response =
      await request(
        app.getHttpServer(),
      )
        .get(
          '/api/v1/auth/me',
        )
        .set(
          'Authorization',
          `Bearer ${auth.accessToken}`,
        )
        .expect(200);

    const body =
      parseJsonObject(
        response.text,
      );

    expect(body.email)
      .toBe(customerEmail);

    expect(body.role)
      .toBe('CUSTOMER');
  });

  it('blocks a customer from the admin namespace', async () => {
    const auth =
      requireAuth(
        customerRegistration,
      );

    await request(
      app.getHttpServer(),
    )
      .get(
        '/api/v1/admin/me',
      )
      .set(
        'Authorization',
        `Bearer ${auth.accessToken}`,
      )
      .expect(403);
  });

  it('rotates the customer refresh token', async () => {
    const auth =
      requireAuth(
        customerRegistration,
      );

    const response =
      await request(
        app.getHttpServer(),
      )
        .post(
          '/api/v1/auth/refresh',
        )
        .send({
          refreshToken:
            auth.refreshToken,
        })
        .expect(200);

    customerRefresh =
      parseAuthenticationResult(
        response.text,
      );

    expect(
      customerRefresh
        .refreshToken,
    ).not.toBe(
      auth.refreshToken,
    );
  });

  it('detects reuse of an already rotated refresh token', async () => {
    const auth =
      requireAuth(
        customerRegistration,
      );

    await request(
      app.getHttpServer(),
    )
      .post(
        '/api/v1/auth/refresh',
      )
      .send({
        refreshToken:
          auth.refreshToken,
      })
      .expect(401);
  });

  it('invalidates access tokens after refresh-token reuse revokes the session', async () => {
    const auth =
      requireAuth(
        customerRefresh,
      );

    await request(
      app.getHttpServer(),
    )
      .get(
        '/api/v1/auth/me',
      )
      .set(
        'Authorization',
        `Bearer ${auth.accessToken}`,
      )
      .expect(401);
  });

  it('creates a fresh customer session through login', async () => {
    const response =
      await request(
        app.getHttpServer(),
      )
        .post(
          '/api/v1/auth/login',
        )
        .send({
          email:
            customerEmail,
          password:
            customerPassword,
        })
        .expect(200);

    customerLogin =
      parseAuthenticationResult(
        response.text,
      );
  });

  it('logs out the current customer session', async () => {
    const auth =
      requireAuth(
        customerLogin,
      );

    await request(
      app.getHttpServer(),
    )
      .post(
        '/api/v1/auth/logout',
      )
      .set(
        'Authorization',
        `Bearer ${auth.accessToken}`,
      )
      .expect(204);
  });

  it('rejects the customer access token after logout', async () => {
    const auth =
      requireAuth(
        customerLogin,
      );

    await request(
      app.getHttpServer(),
    )
      .get(
        '/api/v1/auth/me',
      )
      .set(
        'Authorization',
        `Bearer ${auth.accessToken}`,
      )
      .expect(401);
  });

  it('logs an admin in through the admin namespace', async () => {
    const response =
      await request(
        app.getHttpServer(),
      )
        .post(
          '/api/v1/admin/login',
        )
        .send({
          email:
            adminEmail,
          password:
            adminPassword,
        })
        .expect(200);

    adminLogin =
      parseAuthenticationResult(
        response.text,
      );
  });

  it('returns the authenticated admin from /admin/me', async () => {
    const auth =
      requireAuth(
        adminLogin,
      );

    const response =
      await request(
        app.getHttpServer(),
      )
        .get(
          '/api/v1/admin/me',
        )
        .set(
          'Authorization',
          `Bearer ${auth.accessToken}`,
        )
        .expect(200);

    const body =
      parseJsonObject(
        response.text,
      );

    expect(body.email)
      .toBe(adminEmail);

    expect(body.role)
      .toBe('ADMIN');
  });

  it('blocks an admin from the customer authentication namespace', async () => {
    const auth =
      requireAuth(
        adminLogin,
      );

    await request(
      app.getHttpServer(),
    )
      .get(
        '/api/v1/auth/me',
      )
      .set(
        'Authorization',
        `Bearer ${auth.accessToken}`,
      )
      .expect(403);
  });

  it('logs out the current admin session', async () => {
    const auth =
      requireAuth(
        adminLogin,
      );

    await request(
      app.getHttpServer(),
    )
      .post(
        '/api/v1/admin/logout',
      )
      .set(
        'Authorization',
        `Bearer ${auth.accessToken}`,
      )
      .expect(204);
  });

  it('rejects customer credentials at admin login', async () => {
    await request(
      app.getHttpServer(),
    )
      .post(
        '/api/v1/admin/login',
      )
      .send({
        email:
          customerEmail,
        password:
          customerPassword,
      })
      .expect(401);
  });
});

function requireAuth(
  value:
    | AuthenticationResult
    | null,
): AuthenticationResult {
  if (!value) {
    throw new Error(
      'Expected authentication result.',
    );
  }

  return value;
}

function parseAuthenticationResult(
  text: string,
): AuthenticationResult {
  const value: unknown =
    JSON.parse(text);

  if (
    typeof value !== 'object' ||
    value === null
  ) {
    throw new Error(
      'Expected authentication response object.',
    );
  }

  const candidate =
    value as Record<
      string,
      unknown
    >;

  if (
    typeof candidate.accessToken !==
      'string' ||
    typeof candidate.refreshToken !==
      'string' ||
    candidate.tokenType !==
      'Bearer' ||
    typeof candidate.expiresIn !==
      'number' ||
    typeof candidate.user !==
      'object' ||
    candidate.user === null
  ) {
    throw new Error(
      'Invalid authentication response.',
    );
  }

  return value as AuthenticationResult;
}

function parseJsonObject(
  text: string,
): Record<string, unknown> {
  const value: unknown =
    JSON.parse(text);

  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      'Expected JSON object.',
    );
  }

  return value as Record<
    string,
    unknown
  >;
}
