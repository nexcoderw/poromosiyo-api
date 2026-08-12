import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '@poromosiyo/db';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { PasswordHasherService } from '../src/auth/services/password-hasher.service';
import type { AuthenticationResult } from '../src/auth/types/auth.types';
import { configureApplication } from '../src/bootstrap/configure-application';

describe('Poromosiyo admin operations completion (e2e)', () => {
  let app: INestApplication<App>;

  let prisma: PrismaService;

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const password = 'Poromosiyo-M18-Password-123!';

  const superadminEmail = `m18-super-${suffix}@example.test`;

  const adminEmail = `m18-admin-${suffix}@example.test`;

  const managedAdminEmail = `m18-managed-admin-${suffix}@example.test`;

  const customerEmail = `m18-customer-${suffix}@example.test`;

  const categorySlug = `m18-category-${suffix}`;

  const inactiveCategorySlug = `m18-inactive-${suffix}`;

  const storeSlug = `m18-store-${suffix}`;

  let superadmin: AuthenticationResult;

  let admin: AuthenticationResult;

  let managedAdmin: AuthenticationResult;

  let customerFirst: AuthenticationResult;

  let customerSecond: AuthenticationResult;

  let categoryId = '';

  let inactiveCategoryId = '';

  let storeId = '';

  let firstProductId = '';

  let secondProductId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<INestApplication<App>>();

    configureApplication(app);

    await app.init();

    prisma = app.get(PrismaService);

    await cleanup();

    const passwordHasher = app.get(PasswordHasherService);

    const hash = await passwordHasher.hash(password);

    await prisma.user.createMany({
      data: [
        {
          fullName: 'M18 Superadmin',

          email: superadminEmail,

          passwordHash: hash,

          passwordChangedAt: new Date(),

          emailVerifiedAt: new Date(),

          role: 'SUPERADMIN',
        },

        {
          fullName: 'M18 Admin',

          email: adminEmail,

          passwordHash: hash,

          passwordChangedAt: new Date(),

          emailVerifiedAt: new Date(),

          role: 'ADMIN',
        },
      ],
    });

    superadmin = await loginAdmin(superadminEmail);

    admin = await loginAdmin(adminEmail);

    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'M18 Customer',

        email: customerEmail,

        password,
      })
      .expect(201);

    customerFirst = parseAuth(registration.text);

    customerSecond = await loginCustomer(customerEmail);

    const createdAdmin = await request(app.getHttpServer())
      .post('/api/v1/admin/admins')
      .set('Authorization', `Bearer ${superadmin.accessToken}`)
      .send({
        fullName: 'M18 Managed Admin',

        email: managedAdminEmail,

        password,
      })
      .expect(201);

    expect(parseObject(createdAdmin.text).role).toBe('ADMIN');

    managedAdmin = await loginAdmin(managedAdminEmail);

    const category = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        name: 'M18 Category',

        slug: categorySlug,
      })
      .expect(201);

    categoryId = requireString(parseObject(category.text).id);

    const inactive = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        name: 'M18 Inactive Category',

        slug: inactiveCategorySlug,

        isActive: false,
      })
      .expect(201);

    inactiveCategoryId = requireString(parseObject(inactive.text).id);

    const store = await prisma.store.create({
      data: {
        name: 'M18 Store',
        slug: storeSlug,
      },
    });

    storeId = store.id;

    firstProductId = await createProduct('A');

    secondProductId = await createProduct('B');

    await request(app.getHttpServer())
      .post(`/api/v1/admin/products/${firstProductId}/images`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .field('altText', 'Milestone 18 Product A')
      .attach('image', testImageBuffer(), 'm18-a.png')
      .expect(201);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('writes ordinary catalog mutations to persistent activity history', async () => {
    const activity = await prisma.userActivity.findFirst({
      where: {
        actorUserId: admin.user.id,

        action: 'CATEGORY_CREATED',

        resourceId: categoryId,
      },
    });

    expect(activity).not.toBeNull();
  });

  it('archives many products in one request', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/admin/products/archive')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        productIds: [firstProductId, secondProductId],

        archived: true,
      })
      .expect(200);

    const body = parseObject(response.text);

    expect(body.archived).toBe(true);

    expect(body.selectedCount).toBe(2);

    expect(body.changedCount).toBe(2);

    const products = await prisma.product.findMany({
      where: {
        id: {
          in: [firstProductId, secondProductId],
        },
      },
    });

    expect(
      products.every(
        (product) =>
          product.status === 'ARCHIVED' && product.publishedAt === null,
      ),
    ).toBe(true);

    const activities = await prisma.userActivity.count({
      where: {
        actorUserId: admin.user.id,

        action: 'PRODUCT_ARCHIVED',

        resourceId: {
          in: [firstProductId, secondProductId],
        },
      },
    });

    expect(activities).toBe(2);
  });

  it('makes repeated archive requests idempotent', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/admin/products/archive')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        productIds: [firstProductId, secondProductId],

        archived: true,
      })
      .expect(200);

    expect(parseObject(response.text).changedCount).toBe(0);
  });

  it('restores archived products to draft without publishing them', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/products/archive')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        productIds: [firstProductId, secondProductId],

        archived: false,
      })
      .expect(200);

    const products = await prisma.product.findMany({
      where: {
        id: {
          in: [firstProductId, secondProductId],
        },
      },
    });

    expect(
      products.every(
        (product) => product.status === 'DRAFT' && product.publishedAt === null,
      ),
    ).toBe(true);
  });

  it('prevents editing an ACTIVE product into an invalid publication state', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/products/publication')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        productIds: [firstProductId],

        published: true,
      })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/products/${firstProductId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        categoryId: inactiveCategoryId,
      })
      .expect(409);
  });

  it('provides the global admin audit log with filters', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/activities?action=PRODUCT_ARCHIVED&page=1&limit=20')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    const body = parseObject(response.text);

    expect(Array.isArray(body.items)).toBe(true);

    const items = body.items as Array<Record<string, unknown>>;

    expect(items.every((item) => item.action === 'PRODUCT_ARCHIVED')).toBe(
      true,
    );
  });

  it('returns the initial admin dashboard', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    const body = parseObject(response.text);

    expect(typeof body.customers).toBe('object');

    expect(typeof body.admins).toBe('object');

    expect(typeof body.products).toBe('object');

    expect(Array.isArray(body.recentActivities)).toBe(true);
  });

  it('allows ADMIN to inspect and revoke a customer session', async () => {
    const secondSessionId = readSessionId(customerSecond.accessToken);

    const sessions = await request(app.getHttpServer())
      .get(`/api/v1/admin/customers/${customerFirst.user.id}/sessions`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    const body: unknown = JSON.parse(sessions.text);

    expect(Array.isArray(body)).toBe(true);

    expect(
      (
        body as Array<{
          id: string;
        }>
      ).some((session) => session.id === secondSessionId),
    ).toBe(true);

    await request(app.getHttpServer())
      .delete(
        `/api/v1/admin/customers/${customerFirst.user.id}/sessions/${secondSessionId}`,
      )
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${customerSecond.accessToken}`)
      .expect(401);

    const activity = await prisma.userActivity.findFirst({
      where: {
        subjectUserId: customerFirst.user.id,

        actorUserId: admin.user.id,

        action: 'CUSTOMER_SESSION_REVOKED',

        resourceId: secondSessionId,
      },
    });

    expect(activity).not.toBeNull();
  });

  it('allows ADMIN to logout every customer device', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/admin/customers/${customerFirst.user.id}/logout-all`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${customerFirst.accessToken}`)
      .expect(401);

    const activity = await prisma.userActivity.findFirst({
      where: {
        subjectUserId: customerFirst.user.id,

        actorUserId: admin.user.id,

        action: 'CUSTOMER_LOGOUT_ALL',
      },
    });

    expect(activity).not.toBeNull();
  });

  it('keeps managed ADMIN sessions SUPERADMIN-only', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/admin/admins/${managedAdmin.user.id}/sessions`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/admin/admins/${managedAdmin.user.id}/sessions`)
      .set('Authorization', `Bearer ${superadmin.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/admins/${managedAdmin.user.id}/logout-all`)
      .set('Authorization', `Bearer ${superadmin.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/admin/me')
      .set('Authorization', `Bearer ${managedAdmin.accessToken}`)
      .expect(401);

    const activity = await prisma.userActivity.findFirst({
      where: {
        subjectUserId: managedAdmin.user.id,

        actorUserId: superadmin.user.id,

        action: 'ADMIN_LOGOUT_ALL',
      },
    });

    expect(activity).not.toBeNull();
  });

  it('records self-service session revocation', async () => {
    const secondAdmin = await loginAdmin(adminEmail);

    const sessionId = readSessionId(secondAdmin.accessToken);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/admin/me')
      .set('Authorization', `Bearer ${secondAdmin.accessToken}`)
      .expect(401);

    const activity = await prisma.userActivity.findFirst({
      where: {
        subjectUserId: admin.user.id,

        actorUserId: admin.user.id,

        action: 'SESSION_REVOKED',

        resourceId: sessionId,
      },
    });

    expect(activity).not.toBeNull();
  });

  async function createProduct(label: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        storeId,

        categoryId,

        name: `M18 Product ${label}`,

        sku: `M18-${label}-${suffix}`
          .replace(/[^A-Za-z0-9._-]/g, '-')
          .slice(0, 64),

        description: `Milestone 18 product ${label} description.`,

        originalPrice: '10000.00',

        sellingPrice: '7500.00',
      })
      .expect(201);

    return requireString(parseObject(response.text).id);
  }

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
      managedAdminEmail,
      customerEmail,
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

    await prisma.product.deleteMany({
      where: {
        OR: [
          {
            slug: {
              contains: suffix,
            },
          },
          {
            sku: {
              contains: 'M18-',
            },
          },
        ],
      },
    });

    await prisma.store.deleteMany({
      where: {
        slug: storeSlug,
      },
    });

    await prisma.category.deleteMany({
      where: {
        slug: {
          in: [categorySlug, inactiveCategorySlug],
        },
      },
    });

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

function testImageBuffer(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
}

function readSessionId(accessToken: string): string {
  const parts = accessToken.split('.');

  const payloadPart = parts[1];

  if (!payloadPart) {
    throw new Error('Invalid JWT.');
  }

  const payloadText = Buffer.from(payloadPart, 'base64url').toString('utf8');

  const payload: unknown = JSON.parse(payloadText);

  if (typeof payload !== 'object' || payload === null || !('sid' in payload)) {
    throw new Error('JWT session ID is missing.');
  }

  const candidate = payload as {
    sid?: unknown;
  };

  return requireString(candidate.sid);
}
