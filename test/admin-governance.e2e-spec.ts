import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '@poromosiyo/db';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { PasswordHasherService } from '../src/auth/services/password-hasher.service';
import type { AuthenticationResult } from '../src/auth/types/auth.types';
import { configureApplication } from '../src/bootstrap/configure-application';

describe('Poromosiyo admin governance (e2e)', () => {
  let app: INestApplication<App>;

  let prisma: PrismaService;

  let passwordHasher: PasswordHasherService;

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const superadminEmail = `superadmin-${suffix}@example.test`;

  const adminEmail = `admin-${suffix}@example.test`;

  const createdAdminEmail = `created-admin-${suffix}@example.test`;

  const customerEmail = `customer-${suffix}@example.test`;

  const password = 'Poromosiyo-Governance-Password-123!';

  let superadminAuth: AuthenticationResult;

  let adminAuth: AuthenticationResult;

  let customerAuth: AuthenticationResult;

  let createdAdminId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<INestApplication<App>>();

    configureApplication(app);

    await app.init();

    prisma = app.get(PrismaService);

    passwordHasher = app.get(PasswordHasherService);

    await cleanup();

    const passwordHash = await passwordHasher.hash(password);

    await prisma.user.createMany({
      data: [
        {
          fullName: 'Test Superadmin',
          email: superadminEmail,
          passwordHash,
          passwordChangedAt: new Date(),
          emailVerifiedAt: new Date(),
          role: 'SUPERADMIN',
        },

        {
          fullName: 'Test Admin',
          email: adminEmail,
          passwordHash,
          passwordChangedAt: new Date(),
          emailVerifiedAt: new Date(),
          role: 'ADMIN',
        },
      ],
    });

    superadminAuth = await loginAdmin(superadminEmail);

    adminAuth = await loginAdmin(adminEmail);

    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Governance Customer',
        email: customerEmail,
        password,
      })
      .expect(201);

    customerAuth = parseAuth(registration.text);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('allows SUPERADMIN to use normal admin-protected routes', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/sessions')
      .set('Authorization', `Bearer ${superadminAuth.accessToken}`)
      .expect(200);
  });

  it('lists customers for ADMIN', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/customers')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .expect(200);

    expect(Array.isArray(parseObject(response.text).items)).toBe(true);
  });

  it('lets ADMIN block a customer and immediately invalidates the customer session', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/customers/${customerAuth.user.id}/block`)
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        reason: 'Governance test block',
      })
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${customerAuth.accessToken}`)
      .expect(401);

    const customer = await prisma.user.findUniqueOrThrow({
      where: {
        id: customerAuth.user.id,
      },
    });

    expect(customer.isActive).toBe(false);

    expect(customer.blockedByUserId).toBe(adminAuth.user.id);
  });

  it('shows customer activity history', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/admin/customers/${customerAuth.user.id}/activities`)
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .expect(200);

    const body = parseObject(response.text);

    expect(Array.isArray(body.items)).toBe(true);
  });

  it('lets ADMIN unblock a customer', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/customers/${customerAuth.user.id}/unblock`)
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .expect(204);

    const customer = await prisma.user.findUniqueOrThrow({
      where: {
        id: customerAuth.user.id,
      },
    });

    expect(customer.isActive).toBe(true);

    expect(customer.blockedAt).toBeNull();
  });

  it('prevents ordinary ADMIN from creating another admin', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/admins')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        fullName: 'Blocked Creation',
        email: `forbidden-${suffix}@example.test`,
        password,
      })
      .expect(403);
  });

  it('lets SUPERADMIN create an ADMIN', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/admins')
      .set('Authorization', `Bearer ${superadminAuth.accessToken}`)
      .send({
        fullName: 'Created Admin',
        email: createdAdminEmail,
        password,
      })
      .expect(201);

    const body = parseObject(response.text);

    createdAdminId = requireString(body.id);

    expect(body.role).toBe('ADMIN');
  });

  it('allows ordinary ADMIN to view admins and admin activities', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/admins')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/admin/admins/${createdAdminId}/activities`)
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .expect(200);
  });

  it('prevents ordinary ADMIN from blocking another admin', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/admins/${createdAdminId}/block`)
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        reason: 'Should not be allowed',
      })
      .expect(403);
  });

  it('lets SUPERADMIN block another ADMIN', async () => {
    const createdLogin = await loginAdmin(createdAdminEmail);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/admins/${createdAdminId}/block`)
      .set('Authorization', `Bearer ${superadminAuth.accessToken}`)
      .send({
        reason: 'Governance admin block test',
      })
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/admin/me')
      .set('Authorization', `Bearer ${createdLogin.accessToken}`)
      .expect(401);
  });

  it('lets SUPERADMIN unblock an ADMIN', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/admins/${createdAdminId}/unblock`)
      .set('Authorization', `Bearer ${superadminAuth.accessToken}`)
      .expect(204);
  });

  it('does not allow the admin-management block endpoint to target SUPERADMIN', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/admins/${superadminAuth.user.id}/block`)
      .set('Authorization', `Bearer ${superadminAuth.accessToken}`)
      .send({
        reason: 'Should never work',
      })
      .expect(404);
  });

  async function loginAdmin(email: string): Promise<AuthenticationResult> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/login')
      .send({
        email,
        password,
      })
      .expect(200);

    return parseAuth(response.text);
  }

  async function cleanup(): Promise<void> {
    const emails = [
      superadminEmail,
      adminEmail,
      createdAdminEmail,
      customerEmail,
      `forbidden-${suffix}@example.test`,
    ];

    const users = await prisma.user.findMany({
      where: {
        email: {
          in: emails,
        },
      },
      select: {
        id: true,
      },
    });

    const ids = users.map((user) => user.id);

    if (ids.length > 0) {
      await prisma.userActivity.deleteMany({
        where: {
          OR: [
            {
              actorUserId: {
                in: ids,
              },
            },
            {
              subjectUserId: {
                in: ids,
              },
            },
          ],
        },
      });
    }

    await prisma.user.deleteMany({
      where: {
        email: {
          in: emails,
        },
      },
    });
  }
});

function parseAuth(text: string): AuthenticationResult {
  return JSON.parse(text) as AuthenticationResult;
}

function parseObject(text: string): Record<string, unknown> {
  const value: unknown = JSON.parse(text);

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected JSON object.');
  }

  return value as Record<string, unknown>;
}

function requireString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Expected string.');
  }

  return value;
}
