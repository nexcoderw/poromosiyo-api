import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '@poromosiyo/db';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { PasswordHasherService } from '../src/auth/services/password-hasher.service';
import type { AuthenticationResult } from '../src/auth/types/auth.types';
import { configureApplication } from '../src/bootstrap/configure-application';

describe('Poromosiyo admin product publication (e2e)', () => {
  let app: INestApplication<App>;

  let prisma: PrismaService;

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const adminEmail = `publication-admin-${suffix}@example.test`;

  const customerEmail = `publication-customer-${suffix}@example.test`;

  const adminPassword = 'Poromosiyo-Publication-Admin-123!';

  const customerPassword = 'Poromosiyo-Publication-Customer-123!';

  const categorySlug = `publication-category-${suffix}`;

  const storeSlug = `publication-store-${suffix}`;

  let adminAuth: AuthenticationResult;

  let customerAuth: AuthenticationResult;

  let categoryId = '';

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

    const adminHash = await passwordHasher.hash(adminPassword);

    await prisma.user.create({
      data: {
        fullName: 'Publication Admin',
        email: adminEmail,
        passwordHash: adminHash,
        passwordChangedAt: new Date(),
        role: 'ADMIN',
        emailVerifiedAt: new Date(),
      },
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/admin/login')
      .send({
        email: adminEmail,
        password: adminPassword,
      })
      .expect(200);

    adminAuth = parseAuth(adminLogin.text);

    const customerRegistration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Publication Customer',
        email: customerEmail,
        password: customerPassword,
      })
      .expect(201);

    customerAuth = parseAuth(customerRegistration.text);

    const category = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        name: 'Publication Category',
        slug: categorySlug,
      })
      .expect(201);

    categoryId = requireString(parseObject(category.text).id);

    const store = await prisma.store.create({
      data: {
        name: 'Publication Store',
        slug: storeSlug,
      },
    });

    storeId = store.id;

    const first = await createProduct(
      `M15-A-${suffix}`,
      'Milestone 15 Product A',
    );

    const second = await createProduct(
      `M15-B-${suffix}`,
      'Milestone 15 Product B',
    );

    firstProductId = first;

    secondProductId = second;

    await addImage(firstProductId, 'a');
  });

  afterAll(async () => {
    await cleanup();

    await app.close();
  });

  it('rejects a customer from product publication', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/products/publication')
      .set('Authorization', `Bearer ${customerAuth.accessToken}`)
      .send({
        productIds: [firstProductId],
        published: true,
      })
      .expect(403);
  });

  it('does not allow generic product editing to change publication status', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/products/${firstProductId}`)
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        status: 'ACTIVE',
      })
      .expect(400);
  });

  it('rolls back a multi-product publication when one selected product is incomplete', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/products/publication')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        productIds: [firstProductId, secondProductId],
        published: true,
      })
      .expect(409);

    const products = await prisma.product.findMany({
      where: {
        id: {
          in: [firstProductId, secondProductId],
        },
      },
      select: {
        status: true,
      },
    });

    expect(products.every((product) => product.status === 'DRAFT')).toBe(true);
  });

  it('publishes many selected products atomically', async () => {
    await addImage(secondProductId, 'b');

    const response = await request(app.getHttpServer())
      .patch('/api/v1/admin/products/publication')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        productIds: [firstProductId, secondProductId],
        published: true,
      })
      .expect(200);

    const body = parseObject(response.text);

    expect(body.published).toBe(true);

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
          product.status === 'ACTIVE' && product.publishedAt !== null,
      ),
    ).toBe(true);

    const activities = await prisma.userActivity.findMany({
      where: {
        actorUserId: adminAuth.user.id,
        action: 'PRODUCT_PUBLISHED',
        resourceId: {
          in: [firstProductId, secondProductId],
        },
      },
    });

    expect(activities).toHaveLength(2);
  });

  it('treats repeated publication as an idempotent no-op', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/admin/products/publication')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        productIds: [firstProductId, secondProductId],
        published: true,
      })
      .expect(200);

    const body = parseObject(response.text);

    expect(body.changedCount).toBe(0);
  });

  it('unpublishes many selected products', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/admin/products/publication')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        productIds: [firstProductId, secondProductId],
        published: false,
      })
      .expect(200);

    const body = parseObject(response.text);

    expect(body.published).toBe(false);

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
        (product) => product.status === 'DRAFT' && product.publishedAt === null,
      ),
    ).toBe(true);

    const activities = await prisma.userActivity.findMany({
      where: {
        actorUserId: adminAuth.user.id,
        action: 'PRODUCT_UNPUBLISHED',
        resourceId: {
          in: [firstProductId, secondProductId],
        },
      },
    });

    expect(activities).toHaveLength(2);
  });

  it('persists normal catalog mutation activity', async () => {
    const activity = await prisma.userActivity.findFirst({
      where: {
        actorUserId: adminAuth.user.id,
        action: 'CATEGORY_CREATED',
        resourceId: categoryId,
      },
    });

    expect(activity).not.toBeNull();
  });

  async function createProduct(sku: string, name: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        storeId,
        categoryId,
        name,
        sku: sku.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 64),
        description: 'Complete publication-ready product description.',
        originalPrice: '10000.00',
        sellingPrice: '7500.00',
      })
      .expect(201);

    return requireString(parseObject(response.text).id);
  }

  async function addImage(
    productId: string,
    suffixValue: string,
  ): Promise<void> {
    await request(app.getHttpServer())
      .post(`/api/v1/admin/products/${productId}/images`)
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .field('altText', `Product ${suffixValue}`)
      .attach('image', testImageBuffer(), `${suffixValue}.png`)
      .expect(201);
  }

  async function cleanup(): Promise<void> {
    const users = await prisma.user.findMany({
      where: {
        email: {
          in: [adminEmail, customerEmail],
        },
      },
      select: {
        id: true,
      },
    });

    const userIds = users.map((user) => user.id);

    if (userIds.length > 0) {
      await prisma.userActivity.deleteMany({
        where: {
          OR: [
            {
              actorUserId: {
                in: userIds,
              },
            },
            {
              subjectUserId: {
                in: userIds,
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
            sku: {
              startsWith: 'M15-',
            },
          },
          {
            slug: {
              contains: suffix,
            },
          },
        ],
      },
    });

    await prisma.category.deleteMany({
      where: {
        slug: categorySlug,
      },
    });

    await prisma.store.deleteMany({
      where: {
        slug: storeSlug,
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          in: [adminEmail, customerEmail],
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
