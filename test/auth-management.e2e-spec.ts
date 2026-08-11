import { type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '@poromosiyo/db';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { PasswordHasherService } from '../src/auth/services/password-hasher.service';
import type { AuthenticationResult } from '../src/auth/types/auth.types';
import { configureApplication } from '../src/bootstrap/configure-application';

describe('Poromosiyo authentication management (e2e)', () => {
  let app: INestApplication<App>;

  let prisma: PrismaService;

  let jwt: JwtService;

  let passwordHasher: PasswordHasherService;

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const customerEmail = `session-customer-${suffix}@example.test`;

  const googleOnlyEmail = `google-only-${suffix}@gmail.com`;

  const adminEmail = `session-admin-${suffix}@example.test`;

  const customerPassword = 'Poromosiyo-Session-Customer-123!';

  const googleLocalPassword = 'Poromosiyo-Google-Local-123!';

  const adminPassword = 'Poromosiyo-Session-Admin-123!';

  let registration: AuthenticationResult | null = null;

  let customerLogin: AuthenticationResult | null = null;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<INestApplication<App>>();

    configureApplication(app);

    await app.init();

    prisma = app.get(PrismaService);

    jwt = app.get(JwtService);

    passwordHasher = app.get(PasswordHasherService);

    await cleanupUsers();

    const adminPasswordHash = await passwordHasher.hash(adminPassword);

    await prisma.user.create({
      data: {
        fullName: 'Session Admin',
        email: adminEmail,
        passwordHash: adminPasswordHash,
        passwordChangedAt: new Date(),
        role: 'ADMIN',
      },
    });
  });

  afterAll(async () => {
    await cleanupUsers();

    await app.close();
  });

  it('creates two customer sessions', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Session Customer',
        email: customerEmail,
        password: customerPassword,
      })
      .expect(201);

    registration = parseAuthenticationResult(registerResponse.text);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: customerEmail,
        password: customerPassword,
      })
      .expect(200);

    customerLogin = parseAuthenticationResult(loginResponse.text);
  });

  it('lists active customer sessions and identifies the current session', async () => {
    const login = requireAuth(customerLogin);

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(200);

    const sessions = parseSessionList(response.text);

    expect(sessions.length).toBeGreaterThanOrEqual(2);

    expect(sessions.filter((session) => session.current === true)).toHaveLength(
      1,
    );
  });

  it('revokes another customer session', async () => {
    const login = requireAuth(customerLogin);

    const registrationAuth = requireAuth(registration);

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(200);

    const sessions = parseSessionList(response.text);

    const other = sessions.find((session) => session.current !== true);

    if (!other) {
      throw new Error('Expected another session.');
    }

    await request(app.getHttpServer())
      .delete(`/api/v1/auth/sessions/${other.id}`)
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registrationAuth.accessToken}`)
      .expect(401);
  });

  it('rejects an invalid session UUID', async () => {
    const login = requireAuth(customerLogin);

    await request(app.getHttpServer())
      .delete('/api/v1/auth/sessions/not-a-uuid')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(400);
  });

  it('logs the customer out from every active session', async () => {
    const login = requireAuth(customerLogin);

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .expect(401);
  });

  it('reports Google as the only authentication method for a Google-only customer', async () => {
    const auth = await createGoogleOnlyCustomer();

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/methods')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    const body = parseObject(response.text);

    expect(body.password).toBe(false);

    expect(body.google).toBe(true);
  });

  it('prevents Google unlink when Google is the only login method', async () => {
    const auth = getGoogleOnlySession();

    await request(app.getHttpServer())
      .post('/api/v1/auth/google/unlink')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        currentPassword: googleLocalPassword,
      })
      .expect(409);
  });

  it('allows a Google-only customer to establish a local password', async () => {
    const auth = getGoogleOnlySession();

    await request(app.getHttpServer())
      .post('/api/v1/auth/set-password')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        newPassword: googleLocalPassword,
        confirmPassword: googleLocalPassword,
      })
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(401);
  });

  it('logs the former Google-only customer in with the new local password', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: googleOnlyEmail,
        password: googleLocalPassword,
      })
      .expect(200);

    googleOnlyLogin = parseAuthenticationResult(response.text);
  });

  let googleOnlyLogin: AuthenticationResult | null = null;

  it('unlinks Google only after local-password reauthentication', async () => {
    const auth = requireAuth(googleOnlyLogin);

    await request(app.getHttpServer())
      .post('/api/v1/auth/google/unlink')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        currentPassword: googleLocalPassword,
      })
      .expect(204);

    const methods = await request(app.getHttpServer())
      .get('/api/v1/auth/methods')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    const body = parseObject(methods.text);

    expect(body.password).toBe(true);

    expect(body.google).toBe(false);

    const user = await prisma.user.findUniqueOrThrow({
      where: {
        email: googleOnlyEmail,
      },
      include: {
        accounts: true,
      },
    });

    expect(user.accounts).toHaveLength(0);
  });

  it('lists admin sessions only through the admin namespace', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/login')
      .send({
        email: adminEmail,
        password: adminPassword,
      })
      .expect(200);

    const auth = parseAuthenticationResult(response.text);

    await request(app.getHttpServer())
      .get('/api/v1/admin/sessions')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/admin/logout-all')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/admin/me')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(401);
  });

  let googleOnlyAuth: AuthenticationResult | null = null;

  async function createGoogleOnlyCustomer(): Promise<AuthenticationResult> {
    const user = await prisma.user.create({
      data: {
        fullName: 'Google Only Customer',
        email: googleOnlyEmail,
        image: null,
        passwordHash: null,
        role: 'CUSTOMER',
        isActive: true,
        emailVerifiedAt: new Date(),
        accounts: {
          create: {
            provider: 'GOOGLE',
            providerAccountId: `google-only-${suffix}`,
          },
        },
      },
    });

    const session = await prisma.authSession.create({
      data: {
        userId: user.id,
        userAgent: 'Poromosiyo Milestone 11 Test',
        ipAddress: '127.0.0.1',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = await jwt.signAsync({
      sub: user.id,
      sid: session.id,
      role: 'CUSTOMER',
    });

    googleOnlyAuth = {
      accessToken,
      refreshToken: 'not-required-for-this-test',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        image: user.image,
        role: 'CUSTOMER',
        emailVerified: true,
      },
    };

    return googleOnlyAuth;
  }

  function getGoogleOnlySession(): AuthenticationResult {
    if (!googleOnlyAuth) {
      throw new Error('Google-only session has not been created.');
    }

    return googleOnlyAuth;
  }

  async function cleanupUsers(): Promise<void> {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [customerEmail, googleOnlyEmail, adminEmail],
        },
      },
    });
  }
});

type SessionResponse = {
  id: string;
  current: boolean;
};

function requireAuth(value: AuthenticationResult | null): AuthenticationResult {
  if (!value) {
    throw new Error('Expected authentication result.');
  }

  return value;
}

function parseAuthenticationResult(text: string): AuthenticationResult {
  const value: unknown = JSON.parse(text);

  if (typeof value !== 'object' || value === null) {
    throw new Error('Expected authentication response.');
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.accessToken !== 'string' ||
    typeof candidate.refreshToken !== 'string' ||
    typeof candidate.user !== 'object' ||
    candidate.user === null
  ) {
    throw new Error('Invalid authentication response.');
  }

  return value as AuthenticationResult;
}

function parseSessionList(text: string): SessionResponse[] {
  const value: unknown = JSON.parse(text);

  if (!Array.isArray(value)) {
    throw new Error('Expected session list.');
  }

  return value.map((item) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error('Invalid session entry.');
    }

    const candidate = item as Record<string, unknown>;

    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.current !== 'boolean'
    ) {
      throw new Error('Invalid session entry.');
    }

    return {
      id: candidate.id,
      current: candidate.current,
    };
  });
}

function parseObject(text: string): Record<string, unknown> {
  const value: unknown = JSON.parse(text);

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected JSON object.');
  }

  return value as Record<string, unknown>;
}
