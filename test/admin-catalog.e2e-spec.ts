import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '@poromosiyo/db';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { PasswordHasherService } from '../src/auth/services/password-hasher.service';
import type { AuthenticationResult } from '../src/auth/types/auth.types';
import { configureApplication } from '../src/bootstrap/configure-application';

describe('Poromosiyo admin catalog (e2e)', () => {
  let app: INestApplication<App>;

  let prisma: PrismaService;

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const adminEmail = `catalog-admin-${suffix}@example.test`;

  const customerEmail = `catalog-customer-${suffix}@example.test`;

  const adminPassword = 'Poromosiyo-Catalog-Admin-123!';

  const customerPassword = 'Poromosiyo-Catalog-Customer-123!';

  const rootSlug = `catalog-root-${suffix}`;

  const childSlug = `catalog-child-${suffix}`;

  const brandSlug = `catalog-brand-${suffix}`;

  const storeSlug = `catalog-store-${suffix}`;

  const sku = `M13-${suffix}`.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 64);

  let adminAuth: AuthenticationResult;

  let customerAuth: AuthenticationResult;

  let rootCategoryId = '';

  let childCategoryId = '';

  let brandId = '';

  let storeId = '';

  let productId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<INestApplication<App>>();

    configureApplication(app);

    await app.init();

    prisma = app.get(PrismaService);

    const passwordHasher = app.get(PasswordHasherService);

    await cleanup();

    const adminHash = await passwordHasher.hash(adminPassword);

    await prisma.user.create({
      data: {
        fullName: 'Catalog Admin',
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

    const customerRegister = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Catalog Customer',
        email: customerEmail,
        password: customerPassword,
      })
      .expect(201);

    customerAuth = parseAuth(customerRegister.text);

    const store = await prisma.store.create({
      data: {
        name: 'Catalog Store',
        slug: storeSlug,
      },
    });

    storeId = store.id;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('rejects customer access to admin catalog', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${customerAuth.accessToken}`)
      .expect(403);
  });

  it('creates root and child categories', async () => {
    const root = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        name: 'Catalog Root',
        slug: rootSlug,
        sortOrder: 0,
      })
      .expect(201);

    rootCategoryId = parseId(root.text);

    const child = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        name: 'Catalog Child',
        slug: childSlug,
        parentId: rootCategoryId,
      })
      .expect(201);

    childCategoryId = parseId(child.text);
  });

  it('rejects a category hierarchy cycle', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${rootCategoryId}`)
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        parentId: childCategoryId,
      })
      .expect(409);
  });

  it('creates a brand', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/brands')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        name: 'Catalog Brand',
        slug: brandSlug,
      })
      .expect(201);

    brandId = parseId(response.text);
  });

  it('rejects a product without a genuine discount', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        storeId,
        categoryId: childCategoryId,
        brandId,
        name: 'Invalid Full Price Product',
        sku: `${sku}-BAD`.slice(0, 64),
        description: 'This product must not be accepted.',
        originalPrice: '10000.00',
        sellingPrice: '10000.00',
        expiresAt: futureExpiration(),
      })
      .expect(400);
  });

  it('creates a discounted draft product', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        storeId,
        categoryId: childCategoryId,
        brandId,
        name: 'Discounted Catalog Product',
        sku,
        description: 'A complete product description.',
        originalPrice: '10000.00',
        sellingPrice: '7500.00',
        currency: 'RWF',
        isFeatured: true,
        expiresAt: futureExpiration(),
      })
      .expect(201);

    const body = parseObject(response.text);

    productId = requireString(body.id);

    expect(body.status).toBe('DRAFT');

    expect(body.discountPercentage).toBe('25.00');
  });

  it('does not publish a product without an image', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/products/publication')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        productIds: [productId],
        published: true,
      })
      .expect(409);
  });

  it('adds the first product image as primary', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/admin/products/${productId}/images`)
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .field('altText', 'Discounted catalog product')
      .attach('image', testImageBuffer(), 'product.png')
      .expect(201);

    const body = parseObject(response.text);

    expect(body.isPrimary).toBe(true);
  });

  it('publishes the complete discounted product through the publication endpoint', async () => {
    const publication = await request(app.getHttpServer())
      .patch('/api/v1/admin/products/publication')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        productIds: [productId],
        published: true,
      })
      .expect(200);

    const result = parseObject(publication.text);

    expect(result.published).toBe(true);

    expect(result.changedCount).toBe(1);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/admin/products/${productId}`)
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .expect(200);

    const body = parseObject(response.text);

    expect(body.status).toBe('ACTIVE');

    expect(typeof body.publishedAt).toBe('string');
  });

  it('prevents deactivating a category with active products', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${childCategoryId}`)
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        isActive: false,
      })
      .expect(409);
  });

  it('prevents deactivating a brand with active products', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/brands/${brandId}`)
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({
        isActive: false,
      })
      .expect(409);
  });

  it('lists products using the admin pagination contract', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/products?page=1&limit=20&status=ACTIVE')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .expect(200);

    const body = parseObject(response.text);

    expect(Array.isArray(body.items)).toBe(true);

    expect(body.page).toBe(1);

    expect(body.limit).toBe(20);

    expect(typeof body.total).toBe('number');

    expect(typeof body.totalPages).toBe('number');
  });

  it('does not expose public catalog endpoints yet', async () => {
    await request(app.getHttpServer()).get('/api/v1/products').expect(404);

    await request(app.getHttpServer()).get('/api/v1/categories').expect(404);

    await request(app.getHttpServer()).get('/api/v1/brands').expect(404);
  });

  async function cleanup(): Promise<void> {
    await prisma.product.deleteMany({
      where: {
        OR: [
          {
            sku: {
              startsWith: 'M13-',
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

    await prisma.brand.deleteMany({
      where: {
        slug: {
          contains: suffix,
        },
      },
    });

    await prisma.store.deleteMany({
      where: {
        slug: storeSlug,
      },
    });

    await prisma.category.deleteMany({
      where: {
        slug: childSlug,
      },
    });

    await prisma.category.deleteMany({
      where: {
        slug: rootSlug,
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

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.accessToken !== 'string' ||
    typeof candidate.refreshToken !== 'string'
  ) {
    throw new Error('Invalid authentication response.');
  }

  return value as AuthenticationResult;
}

function futureExpiration(): string {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

function parseId(text: string): string {
  return requireString(parseObject(text).id);
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
