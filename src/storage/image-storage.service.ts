import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

import {
  IMAGE_MAX_DIMENSION,
  IMAGE_OUTPUT_MAX_BYTES,
  IMAGE_WEBP_QUALITY,
} from './image-storage.constants';

type ImageOwner = 'products' | 'profiles' | 'stores';

type StoreImageInput = {
  file: Express.Multer.File;
  owner: ImageOwner;
  ownerId: string;
  slug: string;
};

@Injectable()
export class ImageStorageService {
  private readonly bucket;
  private readonly bucketName: string;
  private readonly testMode: boolean;

  constructor(config: ConfigService) {
    const bucketName = config.getOrThrow<string>('GCS_IMAGE_BUCKET');
    this.bucketName = bucketName;
    this.bucket = new Storage().bucket(bucketName);
    this.testMode = config.get<string>('NODE_ENV') === 'test';
  }

  async store(input: StoreImageInput): Promise<string> {
    if (!input.file?.buffer?.length) {
      throw new BadRequestException('An image file is required.');
    }

    let output: Buffer;

    try {
      output = await optimizeImage(input.file.buffer);
    } catch {
      throw new BadRequestException('The uploaded file is not a valid image.');
    }

    if (output.length > IMAGE_OUTPUT_MAX_BYTES) {
      throw new BadRequestException(
        'The optimized image exceeds 500 KB. Upload a less complex image.',
      );
    }

    const objectPath = `${input.owner}/${input.ownerId}/${slugify(input.slug)}-${Date.now()}-${randomUUID()}.webp`;

    if (this.testMode) {
      return publicObjectUrl(this.bucketName, objectPath);
    }

    try {
      await this.bucket.file(objectPath).save(output, {
        contentType: 'image/webp',
        resumable: false,
        validation: 'crc32c',
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: {
          cacheControl: 'public, max-age=31536000, immutable',
        },
      });
    } catch {
      throw new ServiceUnavailableException(
        'Image storage is temporarily unavailable.',
      );
    }

    return publicObjectUrl(this.bucketName, objectPath);
  }

  async delete(value: string | null | undefined): Promise<void> {
    const objectPath = managedObjectPath(value, this.bucketName);

    if (!objectPath) {
      return;
    }

    if (this.testMode) {
      return;
    }

    await this.bucket.file(objectPath).delete({ ignoreNotFound: true });
  }
}

async function optimizeImage(input: Buffer): Promise<Buffer> {
  const dimensions = [IMAGE_MAX_DIMENSION, 1400, 1200, 1000];
  const qualities = [IMAGE_WEBP_QUALITY, 76, 70, 64];
  let smallest: Buffer | undefined;

  for (const dimension of dimensions) {
    for (const quality of qualities) {
      const output = await sharp(input, {
        failOn: 'warning',
        limitInputPixels: 40_000_000,
      })
        .rotate()
        .resize({
          width: dimension,
          height: dimension,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality, effort: 5 })
        .toBuffer();

      smallest = output;
      if (output.length <= IMAGE_OUTPUT_MAX_BYTES) {
        return output;
      }
    }
  }

  return smallest as Buffer;
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || 'image';
}

function isManagedPath(value: string): boolean {
  return /^(products|profiles|stores)\/[a-zA-Z0-9-]+\//.test(value);
}

function publicObjectUrl(bucketName: string, objectPath: string): string {
  const encodedPath = objectPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `https://storage.googleapis.com/${encodeURIComponent(bucketName)}/${encodedPath}`;
}

function managedObjectPath(
  value: string | null | undefined,
  bucketName: string,
): string | undefined {
  if (!value) {
    return undefined;
  }

  if (isManagedPath(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    const prefix = `/${bucketName}/`;

    if (url.protocol !== 'https:' || url.hostname !== 'storage.googleapis.com') {
      return undefined;
    }

    if (!url.pathname.startsWith(prefix)) {
      return undefined;
    }

    const objectPath = decodeURIComponent(url.pathname.slice(prefix.length));
    return isManagedPath(objectPath) ? objectPath : undefined;
  } catch {
    return undefined;
  }
}
