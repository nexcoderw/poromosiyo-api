import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';

type ImageMetadataProperties = Record<string, object>;

export function ApiImageUpload(
  metadataProperties: ImageMetadataProperties = {},
): MethodDecorator {
  return applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiBody({
      required: true,
      schema: {
        type: 'object',
        required: ['image'],
        properties: {
          image: {
            type: 'string',
            format: 'binary',
            description: 'JPEG, PNG, WebP, HEIC, or HEIF image up to 12 MB.',
          },
          ...metadataProperties,
        },
      },
    }),
  );
}
