import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '@poromosiyo/db';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { GoogleIdTokenVerifierService } from '../src/auth/services/google-id-token-verifier.service';
import { PasswordHasherService } from '../src/auth/services/password-hasher.service';
import type { AuthenticationResult } from '../src/auth/types/auth.types';
import type { VerifiedGoogleIdentity } from '../src/auth/types/google-auth.types';
import { configureApplication } from '../src/bootstrap/configure-application';

describe('Poromosiyo Google authentication (e2e)', () => {
  let app: INestApplication<App>;

  let prisma: PrismaService;

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const localCustomerEmail = `google-local-${suffix}@gmail.com`;

  const newGoogleEmail = `google-new-${suffix}@gmail.com`;

  const adminEmail = `google-admin-${suffix}@gmail.com`;

  const unsafeEmail = `google-third-party-${suffix}@example.net`;

  const customerPassword = 'Poromosiyo-Google-Customer-123!';

  const adminPassword = 'Poromosiyo-Google-Admin-123!';

  let currentIdentity: VerifiedGoogleIdentity = {
    subject: 'initial-test-subject',
    email: 'initial@gmail.com',
    emailVerified: true,
    emailAuthoritative: true,
    fullName: 'Initial Google User',
    image: null,
  };

  const verifier = {
    verify: (): Promise<VerifiedGoogleIdentity> =>
      Promise.resolve(currentIdentity),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GoogleIdTokenVerifierService)
      .useValue(verifier)
      .compile();

    app = moduleFixture.createNestApplication<INestApplication<App>>();

    configureApplication(app);

    await app.init();

    prisma = app.get(PrismaService);

    const passwordHasher = app.get(PasswordHasherService);

    await prisma.user.deleteMany({
      where: {
        email: {
          in: [localCustomerEmail, newGoogleEmail, adminEmail, unsafeEmail],
        },
      },
    });

    const customerHash = await passwordHasher.hash(customerPassword);

    const adminHash = await passwordHasher.hash(adminPassword);

    await prisma.user.create({
      data: {
        fullName: 'Local Google Customer',
        email: localCustomerEmail,
        passwordHash: customerHash,
        passwordChangedAt: new Date(),
        role: 'CUSTOMER',
      },
    });

    await prisma.user.create({
      data: {
        fullName: 'Google Admin',
        email: adminEmail,
        passwordHash: adminHash,
        passwordChangedAt: new Date(),
        role: 'ADMIN',
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [localCustomerEmail, newGoogleEmail, adminEmail, unsafeEmail],
        },
      },
    });

    await app.close();
  });

  it('creates a new customer from an authoritative Google identity', async () => {
    setIdentity({
      subject: `google-new-${suffix}`,
      email: newGoogleEmail,
      emailAuthoritative: true,
      fullName: 'New Google Customer',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({
        idToken: fakeIdToken(),
      })
      .expect(200);

    const auth = parseAuthenticationResult(response.text);

    expect(auth.user.role).toBe('CUSTOMER');

    expect(auth.user.emailVerified).toBe(true);

    const user = await prisma.user.findUnique({
      where: {
        email: newGoogleEmail,
      },
      include: {
        accounts: true,
      },
    });

    expect(user).not.toBeNull();

    expect(user?.passwordHash).toBeNull();

    expect(user?.accounts).toHaveLength(1);
  });

  it('does not silently link Google to an existing password account', async () => {
    setIdentity({
      subject: `google-local-${suffix}`,
      email: localCustomerEmail,
      emailAuthoritative: true,
      fullName: 'Local Google Customer',
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({
        idToken: fakeIdToken(),
      })
      .expect(409);
  });

  it('requires explicit authenticated linking for an existing customer', async () => {
    const login = await loginCustomer();

    setIdentity({
      subject: `google-local-${suffix}`,
      email: localCustomerEmail,
      emailAuthoritative: true,
      fullName: 'Local Google Customer',
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/google/link')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        idToken: fakeIdToken(),
      })
      .expect(204);

    const googleLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({
        idToken: fakeIdToken(),
      })
      .expect(200);

    const result = parseAuthenticationResult(googleLogin.text);

    expect(result.user.email).toBe(localCustomerEmail);
  });

  it('does not auto-create a customer from a non-authoritative third-party Google email', async () => {
    setIdentity({
      subject: `third-party-${suffix}`,
      email: unsafeEmail,
      emailAuthoritative: false,
      fullName: 'Third Party Google User',
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({
        idToken: fakeIdToken(),
      })
      .expect(403);
  });

  it('never creates an admin through Google login', async () => {
    setIdentity({
      subject: `admin-${suffix}`,
      email: adminEmail,
      emailAuthoritative: true,
      fullName: 'Google Admin',
    });

    await request(app.getHttpServer())
      .post('/api/v1/admin/google')
      .send({
        idToken: fakeIdToken(),
      })
      .expect(401);
  });

  it('allows an authenticated admin to link Google', async () => {
    const login = await loginAdmin();

    setIdentity({
      subject: `admin-${suffix}`,
      email: adminEmail,
      emailAuthoritative: true,
      fullName: 'Google Admin',
    });

    await request(app.getHttpServer())
      .post('/api/v1/admin/google/link')
      .set('Authorization', `Bearer ${login.accessToken}`)
      .send({
        idToken: fakeIdToken(),
      })
      .expect(204);

    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/google')
      .send({
        idToken: fakeIdToken(),
      })
      .expect(200);

    const result = parseAuthenticationResult(response.text);

    expect(result.user.role).toBe('ADMIN');
  });

  async function loginCustomer(): Promise<AuthenticationResult> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: localCustomerEmail,
        password: customerPassword,
      })
      .expect(200);

    return parseAuthenticationResult(response.text);
  }

  async function loginAdmin(): Promise<AuthenticationResult> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/login')
      .send({
        email: adminEmail,
        password: adminPassword,
      })
      .expect(200);

    return parseAuthenticationResult(response.text);
  }

  function setIdentity(input: {
    subject: string;
    email: string;
    emailAuthoritative: boolean;
    fullName: string;
  }): void {
    currentIdentity = {
      subject: input.subject,
      email: input.email,
      emailVerified: true,
      emailAuthoritative: input.emailAuthoritative,
      fullName: input.fullName,
      image: 'https://example.test/google-avatar.png',
    };
  }
});

function fakeIdToken(): string {
  return 'x'.repeat(200);
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
