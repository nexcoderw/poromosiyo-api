import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '@poromosiyo/db';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PasswordHasherService } from '../src/auth/services/password-hasher.service';
import type { AuthenticationResult } from '../src/auth/types/auth.types';
import { configureApplication } from '../src/bootstrap/configure-application';

describe('Poromosiyo admin acceptance and hardening (e2e)', () => {
  let app: INestApplication;

  let prisma: PrismaService;

  let passwordHasher: PasswordHasherService;

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const password = 'Poromosiyo-Admin-Acceptance-123!';

  const superadminEmail = `m17-superadmin-${suffix}@example.test`;

  const adminEmail = `m17-admin-${suffix}@example.test`;

  const createdAdminEmail = `m17-created-admin-${suffix}@example.test`;

  const customerEmail = `m17-customer-${suffix}@example.test`;

  let superadmin: AuthenticationResult;

  let admin: AuthenticationResult;

  let customer: AuthenticationResult;

  let createdAdmin: AuthenticationResult | null = null;

  let createdAdminId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    configureApplication(app);

    await app.init();

    prisma = app.get(PrismaService);

    passwordHasher = app.get(PasswordHasherService);

    await cleanup();

    const hash = await passwordHasher.hash(password);

    await prisma.user.createMany({
      data: [
        {
          fullName: 'Milestone 17 Superadmin',
          email: superadminEmail,
          passwordHash: hash,
          role: 'SUPERADMIN',
          isActive: true,
          emailVerifiedAt: new Date(),
          passwordChangedAt: new Date(),
        },

        {
          fullName: 'Milestone 17 Admin',
          email: adminEmail,
          passwordHash: hash,
          role: 'ADMIN',
          isActive: true,
          emailVerifiedAt: new Date(),
          passwordChangedAt: new Date(),
        },
      ],
    });

    superadmin = await loginAdmin(superadminEmail);

    admin = await loginAdmin(adminEmail);

    const customerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Milestone 17 Customer',
        email: customerEmail,
        password,
      })
      .expect(201);

    customer = parseAuth(customerResponse.text);
  });

  afterAll(async () => {
    await cleanup();

    await app.close();
  });

  it('returns 401 for unauthenticated admin requests', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/products')
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/admin/customers')
      .expect(401);
  });

  it('returns 403 when CUSTOMER accesses admin endpoints', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/products')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/v1/admin/customers')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .expect(403);
  });

  it('allows ADMIN to use normal admin catalog and governance reads', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/products')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/admin/customers')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/admin/admins')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
  });

  it('allows SUPERADMIN to inherit normal ADMIN access', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/products')
      .set('Authorization', `Bearer ${superadmin.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/admin/customers')
      .set('Authorization', `Bearer ${superadmin.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/admin/sessions')
      .set('Authorization', `Bearer ${superadmin.accessToken}`)
      .expect(200);
  });

  it('prevents ADMIN from creating another administrator', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/admins')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        fullName: 'Forbidden Administrator',
        email: `forbidden-${suffix}@example.test`,
        password,
      })
      .expect(403);
  });

  it('allows SUPERADMIN to create ADMIN without exposing a password hash', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/admins')
      .set('Authorization', `Bearer ${superadmin.accessToken}`)
      .send({
        fullName: 'Milestone 17 Created Admin',
        email: createdAdminEmail,
        password,
      })
      .expect(201);

    const body = parseObject(response.text);

    createdAdminId = requireString(body.id);

    expect(body.role).toBe('ADMIN');

    expect(body.password).toBeUndefined();

    expect(body.passwordHash).toBeUndefined();

    createdAdmin = await loginAdmin(createdAdminEmail);
  });

  it('rejects malformed governed account IDs', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/customers/not-a-uuid')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/v1/admin/admins/not-a-uuid')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(400);
  });

  it('rejects governance pagination above the maximum limit', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/customers?limit=101')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/v1/admin/admins?limit=101')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(400);
  });

  it('rejects duplicate product IDs in bulk publication', async () => {
    const productId = '00000000-0000-4000-8000-000000000017';

    await request(app.getHttpServer())
      .patch('/api/v1/admin/products/publication')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        productIds: [productId, productId],
        published: true,
      })
      .expect(400);
  });

  it('rejects publication batches larger than 100 products', async () => {
    const ids = Array.from(
      {
        length: 101,
      },
      (_value, index) => {
        const suffixValue = String(index + 1).padStart(12, '0');

        return '00000000-0000-4000-8000-' + suffixValue;
      },
    );

    await request(app.getHttpServer())
      .patch('/api/v1/admin/products/publication')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        productIds: ids,
        published: true,
      })
      .expect(400);
  });

  it('blocks CUSTOMER and invalidates both access and refresh credentials', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/customers/${customer.user.id}/block`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        reason: 'Milestone 17 blocking test',
      })
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: customer.refreshToken,
      })
      .expect(401);

    const persisted = await prisma.user.findUniqueOrThrow({
      where: {
        id: customer.user.id,
      },
    });

    expect(persisted.isActive).toBe(false);

    expect(persisted.blockedByUserId).toBe(admin.user.id);
  });

  it('records customer block activity', async () => {
    const activity = await prisma.userActivity.findFirst({
      where: {
        subjectUserId: customer.user.id,
        actorUserId: admin.user.id,
        action: 'CUSTOMER_BLOCKED',
      },
    });

    expect(activity).not.toBeNull();
  });

  it('unblocks CUSTOMER without restoring old sessions', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/customers/${customer.user.id}/unblock`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .expect(401);

    customer = await loginCustomer(customerEmail);
  });

  it('prevents ADMIN from blocking another ADMIN', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/admins/${createdAdminId}/block`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        reason: 'Ordinary admin must not do this',
      })
      .expect(403);
  });

  it('allows SUPERADMIN to block ADMIN and invalidates that admin session', async () => {
    if (!createdAdmin) {
      throw new Error('Created admin login is missing.');
    }

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/admins/${createdAdminId}/block`)
      .set('Authorization', `Bearer ${superadmin.accessToken}`)
      .send({
        reason: 'Milestone 17 administrator block',
      })
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/admin/me')
      .set('Authorization', `Bearer ${createdAdmin.accessToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/admin/refresh')
      .send({
        refreshToken: createdAdmin.refreshToken,
      })
      .expect(401);
  });

  it('never allows normal administrator governance to block SUPERADMIN', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/admins/${superadmin.user.id}/block`)
      .set('Authorization', `Bearer ${superadmin.accessToken}`)
      .send({
        reason: 'Must not work',
      })
      .expect(404);

    await request(app.getHttpServer())
      .get('/api/v1/admin/me')
      .set('Authorization', `Bearer ${superadmin.accessToken}`)
      .expect(200);
  });

  it('keeps public catalog endpoints disabled', async () => {
    await request(app.getHttpServer()).get('/api/v1/products').expect(404);

    await request(app.getHttpServer()).get('/api/v1/categories').expect(404);

    await request(app.getHttpServer()).get('/api/v1/brands').expect(404);
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

  async function loginCustomer(email: string): Promise<AuthenticationResult> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
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
              subjectUserId: {
                in: ids,
              },
            },

            {
              actorUserId: {
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
  const value: unknown = JSON.parse(text);

  if (typeof value !== 'object' || value === null) {
    throw new Error('Expected authentication response.');
  }

  return value as AuthenticationResult;
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
