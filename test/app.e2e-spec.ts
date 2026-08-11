import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '@poromosiyo/db';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap/configure-application';

describe('Poromosiyo authentication routes (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const email = `phase7-${Date.now()}@example.test`;

  const password = 'Poromosiyo-Phase7-Password-123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<INestApplication<App>>();

    configureApplication(app);

    await app.init();

    prisma = app.get(PrismaService);

    await prisma.user.deleteMany({
      where: {
        email,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email,
      },
    });

    await app.close();
  });

  it('registers a customer through /api/v1/auth/register', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Phase Seven Customer',
        email,
        password,
      })
      .expect(201);
  });

  it('logs in a customer through /api/v1/auth/login', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email,
        password,
      })
      .expect(200);
  });

  it('does not allow a customer account through /api/v1/admin/login', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/login')
      .send({
        email,
        password,
      })
      .expect(401);
  });

  it('rejects invalid registration payloads', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: '',
        email: 'not-an-email',
        password: 'short',
      })
      .expect(400);
  });
});
