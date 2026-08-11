import {
  ValidationPipe,
} from '@nestjs/common';
import {
  ConfigService,
} from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app =
    await NestFactory.create(AppModule);

  const config =
    app.get(ConfigService);

  const allowedOrigins =
    config
      .getOrThrow<string>(
        'FRONTEND_ALLOWED_ORIGINS',
      )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

  app.use(helmet());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  const port =
    config.getOrThrow<number>('PORT');

  const host =
    config.getOrThrow<string>('HOST');

  await app.listen(
    port,
    host,
  );
}

bootstrap().catch(
  (error: unknown) => {
    console.error(
      'Poromosiyo API failed to start.',
    );

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }

    process.exitCode = 1;
  },
);
