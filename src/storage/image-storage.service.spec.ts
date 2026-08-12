import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';

import { ImageStorageService } from './image-storage.service';

describe('ImageStorageService', () => {
  const service = new ImageStorageService(
    new ConfigService({
      GCS_IMAGE_BUCKET: 'poromosiyo-images',
      NODE_ENV: 'test',
    }),
  );

  it('returns an organized WebP object path instead of image data', async () => {
    const buffer = await sharp({
      create: {
        width: 2000,
        height: 1000,
        channels: 3,
        background: '#3498db',
      },
    })
      .jpeg()
      .toBuffer();

    const path = await service.store({
      file: upload(buffer, 'phone-photo.jpg', 'image/jpeg'),
      owner: 'products',
      ownerId: '4fa-product-id',
      slug: 'Summer Product',
    });

    expect(path).toMatch(
      /^products\/4fa-product-id\/summer-product-\d+-[0-9a-f-]+\.webp$/,
    );
    expect(path).not.toContain('base64');
  });

  it('rejects content that is not an image', async () => {
    await expect(
      service.store({
        file: upload(Buffer.from('not an image'), 'fake.jpg', 'image/jpeg'),
        owner: 'profiles',
        ownerId: 'user-id',
        slug: 'User Name',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function upload(
  buffer: Buffer,
  originalname: string,
  mimetype: string,
): Express.Multer.File {
  return {
    buffer,
    originalname,
    mimetype,
    fieldname: 'image',
    encoding: '7bit',
    size: buffer.length,
    stream: undefined as never,
    destination: '',
    filename: '',
    path: '',
  };
}
