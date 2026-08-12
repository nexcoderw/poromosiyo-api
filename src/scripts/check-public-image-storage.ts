import 'dotenv/config';

import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

import { IMAGE_CACHE_CONTROL } from '../storage/image-storage.constants';

async function main(): Promise<void> {
  const bucketName = required('GCS_IMAGE_BUCKET');

  const publicBaseUrl = (process.env.GCS_IMAGE_PUBLIC_BASE_URL ?? '')
    .trim()
    .replace(/\/+$/, '');

  const storage = new Storage();

  const bucket = storage.bucket(bucketName);

  const objectPath = `health/public-media-${Date.now()}-${randomUUID()}.webp`;

  const image = await sharp({
    create: {
      width: 16,

      height: 16,

      channels: 3,

      background: {
        r: 128,

        g: 128,

        b: 128,
      },
    },
  })
    .webp({
      quality: 70,
    })
    .toBuffer();

  try {
    await bucket.file(objectPath).save(image, {
      contentType: 'image/webp',

      resumable: false,

      validation: 'crc32c',

      metadata: {
        cacheControl: IMAGE_CACHE_CONTROL,

        contentDisposition: 'inline',
      },
    });

    const url = publicUrl(bucketName, objectPath, publicBaseUrl);

    const response = await fetch(url, {
      method: 'GET',

      cache: 'no-store',

      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`Public GET returned HTTP ${response.status}.`);
    }

    const contentType = response.headers.get('content-type');

    if (!contentType?.includes('image/webp')) {
      throw new Error(`Unexpected Content-Type: ${contentType}`);
    }

    const cacheControl = response.headers.get('cache-control') ?? '';

    if (!cacheControl.includes('max-age=31536000')) {
      throw new Error(`Long-lived public caching is missing: ${cacheControl}`);
    }

    console.log('Public Google Cloud Storage image verification successful.');

    console.log(`Public URL: ${url}`);

    console.log(`Cache-Control: ${cacheControl}`);
  } finally {
    await bucket.file(objectPath).delete({
      ignoreNotFound: true,
    });
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function publicUrl(
  bucketName: string,
  objectPath: string,
  baseUrl: string,
): string {
  const path = objectPath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');

  if (baseUrl) {
    return `${baseUrl}/${path}`;
  }

  return `https://storage.googleapis.com/${encodeURIComponent(
    bucketName,
  )}/${path}`;
}

main().catch((error: unknown) => {
  console.error('Public GCS image verification failed.');

  console.error(error instanceof Error ? error.message : String(error));

  process.exitCode = 1;
});
