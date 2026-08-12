import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const API_DOCUMENTATION_PATH = 'api/v1/docs';

export function configureApiDocumentation(app: INestApplication): void {
  const configuration = new DocumentBuilder()
    .setTitle('Poromosiyo API')
    .setDescription(
      'Interactive documentation for Poromosiyo customer authentication, administration, governance, catalog, media, and product-expiration endpoints.',
    )
    .setVersion('1')
    .addServer('http://localhost:3000', 'Local development')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste the access token returned by a login endpoint.',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, configuration, {
    deepScanRoutes: true,
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
  });

  SwaggerModule.setup(API_DOCUMENTATION_PATH, app, document, {
    customSiteTitle: 'Poromosiyo API Documentation',
    jsonDocumentUrl: `/${API_DOCUMENTATION_PATH}-json`,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
}
