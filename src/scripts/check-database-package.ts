import 'dotenv/config';

import { PrismaService } from '@poromosiyo/db';
import { NestFactory } from '@nestjs/core';

import { DatabaseModule } from '../database/database.module';

type DatabaseProbe = {
  databaseName: string | null;
  databaseVersion: string;
};

async function main(): Promise<void> {
  const application = await NestFactory.createApplicationContext(
    DatabaseModule,
    {
      logger: false,
    },
  );

  try {
    const prisma = application.get(PrismaService);

    const rows = await prisma.$queryRaw<DatabaseProbe[]>`
      SELECT
        DATABASE() AS databaseName,
        VERSION() AS databaseVersion
    `;

    const database = rows[0];

    if (!database?.databaseName) {
      throw new Error(
        'The API DB package connected without a selected database.',
      );
    }

    console.log('Poromosiyo API database package integration successful.');

    console.log(`Database: ${database.databaseName}`);

    console.log(`Database version: ${database.databaseVersion}`);
  } finally {
    await application.close();
  }
}

main().catch((error: unknown) => {
  console.error('Poromosiyo API database package integration failed.');

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }

  process.exitCode = 1;
});
