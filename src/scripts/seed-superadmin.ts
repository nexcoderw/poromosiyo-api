import 'dotenv/config';

import {
  isEmail,
} from 'class-validator';
import {
  PrismaService,
} from '@poromosiyo/db';

import {
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
  USER_EMAIL_MAX_LENGTH,
  USER_FULL_NAME_MAX_LENGTH,
} from '../auth/auth.constants';
import {
  PasswordHasherService,
} from '../auth/services/password-hasher.service';

async function main():
  Promise<void> {
  process.env.DATABASE_CONNECT_ON_INIT =
    'false';

  const input =
    readSeedEnvironment();

  const prisma =
    new PrismaService();

  const passwordHasher =
    new PasswordHasherService();

  try {
    await prisma.$connect();

    const existingSuperadmins =
      await prisma.user
        .findMany({
          where: {
            role:
              'SUPERADMIN',
          },
          select: {
            id: true,
            email: true,
            isActive:
              true,
          },
        });

    if (
      existingSuperadmins.length >
      1
    ) {
      throw new Error(
        'More than one SUPERADMIN already exists. Refusing to seed.',
      );
    }

    const existingSuperadmin =
      existingSuperadmins[0];

    if (existingSuperadmin) {
      if (
        normalizeEmail(
          existingSuperadmin.email,
        ) !==
        input.email
      ) {
        throw new Error(
          `A SUPERADMIN already exists with another email: ${existingSuperadmin.email}`,
        );
      }

      console.log(
        'Poromosiyo SUPERADMIN is already seeded.',
      );

      console.log(
        `Email: ${existingSuperadmin.email}`,
      );

      console.log(
        'No database changes were made.',
      );

      return;
    }

    const existingEmail =
      await prisma.user
        .findUnique({
          where: {
            email:
              input.email,
          },
          select: {
            id: true,
            role: true,
          },
        });

    if (existingEmail) {
      throw new Error(
        `SUPERADMIN_EMAIL already belongs to a ${existingEmail.role} account.`,
      );
    }

    const passwordHash =
      await passwordHasher
        .hash(
          input.password,
        );

    if (
      passwordHash ===
      input.password
    ) {
      throw new Error(
        'Password hashing failed.',
      );
    }

    const passwordVerified =
      await passwordHasher
        .verify(
          passwordHash,
          input.password,
        );

    if (!passwordVerified) {
      throw new Error(
        'Generated SUPERADMIN password hash could not be verified.',
      );
    }

    const now =
      new Date();

    const superadmin =
      await prisma
        .$transaction(
          async (
            transaction,
          ) => {
            const user =
              await transaction
                .user
                .create({
                  data: {
                    fullName:
                      input.fullName,

                    email:
                      input.email,

                    passwordHash,

                    role:
                      'SUPERADMIN',

                    isActive:
                      true,

                    emailVerifiedAt:
                      now,

                    passwordChangedAt:
                      now,

                    failedLoginAttempts:
                      0,

                    lockedUntil:
                      null,
                  },

                  select: {
                    id: true,
                    fullName:
                      true,
                    email: true,
                    role: true,
                    isActive:
                      true,
                    emailVerifiedAt:
                      true,
                  },
                });

            await transaction
              .userActivity
              .create({
                data: {
                  subjectUserId:
                    user.id,

                  actorUserId:
                    null,

                  action:
                    'SUPERADMIN_SEEDED',

                  resourceType:
                    'USER',

                  resourceId:
                    user.id,

                  description:
                    'Initial SUPERADMIN account seeded from protected environment configuration.',
                },
              });

            return user;
          },
        );

    const persisted =
      await prisma.user
        .findUniqueOrThrow({
          where: {
            id:
              superadmin.id,
          },

          select: {
            id: true,
            email: true,
            role: true,
            isActive:
              true,
            emailVerifiedAt:
              true,
            passwordHash:
              true,
          },
        });

    if (
      persisted.role !==
      'SUPERADMIN'
    ) {
      throw new Error(
        'Seeded account does not have SUPERADMIN role.',
      );
    }

    if (
      !persisted.passwordHash
    ) {
      throw new Error(
        'Seeded SUPERADMIN does not have a password hash.',
      );
    }

    if (
      persisted.passwordHash ===
      input.password
    ) {
      throw new Error(
        'SUPERADMIN password was stored without hashing.',
      );
    }

    const persistedPasswordMatches =
      await passwordHasher
        .verify(
          persisted.passwordHash,
          input.password,
        );

    if (
      !persistedPasswordMatches
    ) {
      throw new Error(
        'Persisted SUPERADMIN password hash verification failed.',
      );
    }

    console.log();
    console.log(
      'Poromosiyo SUPERADMIN seeded successfully.',
    );

    console.log(
      `ID: ${persisted.id}`,
    );

    console.log(
      `Email: ${persisted.email}`,
    );

    console.log(
      `Role: ${persisted.role}`,
    );

    console.log(
      `Active: ${persisted.isActive}`,
    );

    console.log(
      `Email verified: ${
        persisted.emailVerifiedAt !==
        null
      }`,
    );

    console.log(
      'Password storage: Argon2id hash verified.',
    );

    console.log();
    console.log(
      'The plaintext password was not stored in the database.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

function readSeedEnvironment(): {
  fullName: string;
  email: string;
  password: string;
} {
  const fullName =
    requiredEnvironmentValue(
      'SUPERADMIN_FULL_NAME',
    )
      .trim()
      .replace(
        /\s+/g,
        ' ',
      );

  const email =
    normalizeEmail(
      requiredEnvironmentValue(
        'SUPERADMIN_EMAIL',
      ),
    );

  const password =
    requiredEnvironmentValue(
      'SUPERADMIN_PASSWORD',
    );

  if (
    fullName.length <
      2 ||
    fullName.length >
      USER_FULL_NAME_MAX_LENGTH
  ) {
    throw new Error(
      `SUPERADMIN_FULL_NAME must contain 2-${USER_FULL_NAME_MAX_LENGTH} characters.`,
    );
  }

  if (
    email.length >
      USER_EMAIL_MAX_LENGTH ||
    !isEmail(email)
  ) {
    throw new Error(
      'SUPERADMIN_EMAIL must be a valid email address.',
    );
  }

  if (
    password.length <
      AUTH_PASSWORD_MIN_LENGTH ||
    password.length >
      AUTH_PASSWORD_MAX_LENGTH
  ) {
    throw new Error(
      `SUPERADMIN_PASSWORD must contain ${AUTH_PASSWORD_MIN_LENGTH}-${AUTH_PASSWORD_MAX_LENGTH} characters.`,
    );
  }

  return {
    fullName,
    email,
    password,
  };
}

function requiredEnvironmentValue(
  key: string,
): string {
  const value =
    process.env[key];

  if (
    typeof value !==
      'string' ||
    value.length ===
      0
  ) {
    throw new Error(
      `${key} is required in the API .env file.`,
    );
  }

  return value;
}

function normalizeEmail(
  email: string,
): string {
  return email
    .trim()
    .toLowerCase();
}

main().catch(
  (error: unknown) => {
    console.error();
    console.error(
      'Poromosiyo SUPERADMIN seed failed.',
    );

    if (
      error instanceof
      Error
    ) {
      console.error(
        error.message,
      );
    } else {
      console.error(
        String(error),
      );
    }

    process.exitCode = 1;
  },
);
