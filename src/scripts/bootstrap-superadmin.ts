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
import {
  GOVERNANCE_ACTIVITY_ACTION,
} from '../admin/governance/admin-governance.constants';

async function main():
  Promise<void> {
  process.env.DATABASE_CONNECT_ON_INIT =
    'false';

  const fullName =
    required(
      'SUPERADMIN_FULL_NAME',
    )
      .trim()
      .replace(
        /\s+/g,
        ' ',
      );

  const email =
    required(
      'SUPERADMIN_EMAIL',
    )
      .trim()
      .toLowerCase();

  const password =
    required(
      'SUPERADMIN_PASSWORD',
    );

  if (
    fullName.length < 2 ||
    fullName.length >
      USER_FULL_NAME_MAX_LENGTH
  ) {
    throw new Error(
      'SUPERADMIN_FULL_NAME is invalid.',
    );
  }

  if (
    !isEmail(email) ||
    email.length >
      USER_EMAIL_MAX_LENGTH
  ) {
    throw new Error(
      'SUPERADMIN_EMAIL is invalid.',
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

  const prisma =
    new PrismaService();

  const passwordHasher =
    new PasswordHasherService();

  try {
    await prisma.$connect();

    const existingSuperadmin =
      await prisma.user
        .findFirst({
          where: {
            role:
              'SUPERADMIN',
          },
          select: {
            id:
              true,
            email:
              true,
          },
        });

    if (existingSuperadmin) {
      throw new Error(
        `SUPERADMIN already exists: ${existingSuperadmin.email}`,
      );
    }

    const existingEmail =
      await prisma.user
        .findUnique({
          where: {
            email,
          },
          select: {
            id:
              true,
            role:
              true,
          },
        });

    if (existingEmail) {
      throw new Error(
        'SUPERADMIN_EMAIL already belongs to another account.',
      );
    }

    const passwordHash =
      await passwordHasher
        .hash(password);

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
                    fullName,
                    email,
                    passwordHash,
                    role:
                      'SUPERADMIN',
                    isActive:
                      true,
                    emailVerifiedAt:
                      now,
                    passwordChangedAt:
                      now,
                  },
                  select: {
                    id:
                      true,
                    email:
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
                    GOVERNANCE_ACTIVITY_ACTION
                      .SUPERADMIN_BOOTSTRAPPED,
                  resourceType:
                    'USER',
                  resourceId:
                    user.id,
                  description:
                    'Initial SUPERADMIN securely bootstrapped.',
                },
              });

            return user;
          },
        );

    console.log(
      'Poromosiyo SUPERADMIN bootstrap successful.',
    );

    console.log(
      `Email: ${superadmin.email}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

function required(
  name: string,
): string {
  const value =
    process.env[name];

  if (!value) {
    throw new Error(
      `${name} is required.`,
    );
  }

  return value;
}

main().catch(
  (error: unknown) => {
    console.error(
      'Poromosiyo SUPERADMIN bootstrap failed.',
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
