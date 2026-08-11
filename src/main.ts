import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { configureApplication } from './bootstrap/configure-application';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  configureApplication(app);

  const config = app.get(ConfigService);

  const port = config.getOrThrow<number>('PORT');

  const host = config.getOrThrow<string>('HOST');

  await app.listen(port, host);
}

bootstrap().catch((error: unknown) => {
  console.error('Poromosiyo API failed to start.');

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }

  process.exitCode = 1;
});
