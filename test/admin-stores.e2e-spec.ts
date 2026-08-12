import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '@poromosiyo/db';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { PasswordHasherService } from '../src/auth/services/password-hasher.service';
import type { AuthenticationResult } from '../src/auth/types/auth.types';
import { configureApplication } from '../src/bootstrap/configure-application';

describe('Poromosiyo admin stores (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `store-admin-${suffix}@example.test`;
  const password = 'Poromosiyo-Store-Test-123!';
  const storeSlug = `store-${suffix}`;
  const secondStoreSlug = `store-second-${suffix}`;
  const categorySlug = `store-category-${suffix}`;

  let auth: AuthenticationResult;
  let storeId = '';
  let secondStoreId = '';
  let categoryId = '';
  let productId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();

    prisma = app.get(PrismaService);
    await cleanup();

    const hasher = app.get(PasswordHasherService);
    const hash = await hasher.hash(password);

    await prisma.user.create({
      data: {
        fullName: 'Store Admin',
        email,
        passwordHash: hash,
        passwordChangedAt: new Date(),
        emailVerifiedAt: new Date(),
        role: 'ADMIN',
      },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/admin/login')
      .send({ email, password })
      .expect(200);

    auth = JSON.parse(login.text) as AuthenticationResult;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('creates stores', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/v1/admin/stores')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ name: 'Primary Store', slug: storeSlug })
      .expect(201);

    storeId = requireString(parseObject(first.text).id);

    const second = await request(app.getHttpServer())
      .post('/api/v1/admin/stores')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ name: 'Second Store', slug: secondStoreSlug })
      .expect(201);

    secondStoreId = requireString(parseObject(second.text).id);
  });

  it('requires storeId when creating a product', async () => {
    const category = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ name: 'Store Category', slug: categorySlug })
      .expect(201);

    categoryId = requireString(parseObject(category.text).id);

    await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        categoryId,
        name: 'Missing Store Product',
        sku: normalizeSku(`M19-MISSING-${suffix}`),
        originalPrice: '10000',
        sellingPrice: '8000',
      })
      .expect(400);
  });

  it('creates a product from a specific store', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        storeId,
        categoryId,
        name: 'Store Product',
        sku: normalizeSku(`M19-${suffix}`),
        description: 'A product from the primary store.',
        originalPrice: '10000',
        sellingPrice: '8000',
      })
      .expect(201);

    const body = parseObject(response.text);
    productId = requireString(body.id);
    expect(body.storeId).toBe(storeId);
  });

  it('filters products by store', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/admin/products?storeId=${storeId}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(Array.isArray(parseObject(response.text).items)).toBe(true);
  });

  it('bulk moves products to another store', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/products/store')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ productIds: [productId], storeId: secondStoreId })
      .expect(200);

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });

    expect(product.storeId).toBe(secondStoreId);
  });

  it('does not delete a store with products', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/stores/${secondStoreId}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(409);
  });

  async function cleanup(): Promise<void> {
    await prisma.product.deleteMany({
      where: { sku: { contains: 'M19-' } },
    });

    await prisma.category.deleteMany({
      where: { slug: categorySlug },
    });

    await prisma.store.deleteMany({
      where: { slug: { in: [storeSlug, secondStoreSlug] } },
    });

    await prisma.user.deleteMany({ where: { email } });
  }
});

function normalizeSku(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 64);
}

function parseObject(text: string): Record<string, unknown> {
  const value: unknown = JSON.parse(text);

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected object.');
  }

  return value as Record<string, unknown>;
}

function requireString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Expected string.');
  }

  return value;
}
