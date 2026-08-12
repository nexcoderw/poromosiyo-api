import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ConfigService,
} from '@nestjs/config';
import {
  Storage,
} from '@google-cloud/storage';
import {
  randomUUID,
} from 'node:crypto';
import sharp from 'sharp';

import {
  CATALOG_IMAGE_MAX_DIMENSION,
  CATALOG_IMAGE_OUTPUT_MAX_BYTES,
  IMAGE_CACHE_CONTROL,
  IMAGE_MAX_DIMENSION,
  IMAGE_OUTPUT_MAX_BYTES,
  IMAGE_WEBP_QUALITY,
  LOGO_IMAGE_MAX_DIMENSION,
  LOGO_IMAGE_OUTPUT_MAX_BYTES,
} from './image-storage.constants';

type ImageOwner =
  | 'products'
  | 'profiles'
  | 'stores'
  | 'categories'
  | 'brands';

type StoreImageInput = {
  file:
    Express.Multer.File;

  owner:
    ImageOwner;

  ownerId:
    string;

  slug:
    string;
};

type EncodingProfile = {
  dimension:
    number;

  quality:
    number;
};

@Injectable()
export class ImageStorageService {
  private readonly logger =
    new Logger(
      ImageStorageService.name,
    );

  private readonly bucket;

  private readonly bucketName:
    string;

  private readonly publicBaseUrl:
    string;

  private readonly testMode:
    boolean;

  constructor(
    config:
      ConfigService,
  ) {
    this.bucketName =
      config.getOrThrow<string>(
        'GCS_IMAGE_BUCKET',
      );

    this.publicBaseUrl =
      (
        config.get<string>(
          'GCS_IMAGE_PUBLIC_BASE_URL',
        ) ?? ''
      )
        .trim()
        .replace(
          /\/+$/,
          '',
        );

    this.bucket =
      new Storage()
        .bucket(
          this.bucketName,
        );

    this.testMode =
      config.get<string>(
        'NODE_ENV',
      ) === 'test';
  }

  async store(
    input:
      StoreImageInput,
  ): Promise<string> {
    if (
      !input.file?.buffer
        ?.length
    ) {
      throw new BadRequestException(
        'An image file is required.',
      );
    }

    let output:
      Buffer;

    try {
      output =
        await optimizeImage(
          input.file.buffer,
          input.owner,
        );
    } catch {
      throw new BadRequestException(
        'The uploaded file is not a valid image.',
      );
    }

    const maxBytes =
      getOutputLimit(
        input.owner,
      );

    if (
      output.length >
      maxBytes
    ) {
      throw new BadRequestException(
        'The optimized image is still too large. Upload a less complex image.',
      );
    }

    const objectPath =
      [
        input.owner,
        input.ownerId,
        `${
          slugify(
            input.slug,
          )
        }-${
          Date.now()
        }-${
          randomUUID()
        }.webp`,
      ].join('/');

    if (
      this.testMode
    ) {
      return buildPublicUrl(
        this.bucketName,
        objectPath,
        this.publicBaseUrl,
      );
    }

    try {
      await this.bucket
        .file(
          objectPath,
        )
        .save(
          output,
          {
            contentType:
              'image/webp',

            resumable:
              false,

            validation:
              'crc32c',

            preconditionOpts: {
              ifGenerationMatch:
                0,
            },

            metadata: {
              cacheControl:
                IMAGE_CACHE_CONTROL,

              contentDisposition:
                'inline',
            },
          },
        );
    } catch {
      throw new ServiceUnavailableException(
        'Image storage is temporarily unavailable.',
      );
    }

    return buildPublicUrl(
      this.bucketName,
      objectPath,
      this.publicBaseUrl,
    );
  }

  async delete(
    value:
      | string
      | null
      | undefined,
  ): Promise<void> {
    const objectPath =
      managedObjectPath(
        value,
        this.bucketName,
        this.publicBaseUrl,
      );

    if (!objectPath) {
      return;
    }

    if (
      this.testMode
    ) {
      return;
    }

    await this.bucket
      .file(
        objectPath,
      )
      .delete({
        ignoreNotFound:
          true,
      });
  }

  async deleteQuietly(
    value:
      | string
      | null
      | undefined,
  ): Promise<void> {
    try {
      await this.delete(
        value,
      );
    } catch (
      error: unknown
    ) {
      this.logger.warn(
        `Failed to clean up image object: ${
          error instanceof
          Error
            ? error.message
            : String(
                error,
              )
        }`,
      );
    }
  }

  async deleteManyQuietly(
    values:
      readonly (
        | string
        | null
        | undefined
      )[],
  ): Promise<void> {
    await Promise.all(
      values.map(
        (value) =>
          this.deleteQuietly(
            value,
          ),
      ),
    );
  }
}

async function optimizeImage(
  input:
    Buffer,
  owner:
    ImageOwner,
): Promise<Buffer> {
  const profiles =
    getEncodingProfiles(
      owner,
    );

  let smallest:
    Buffer | undefined;

  for (
    const profile
    of profiles
  ) {
    const output =
      await sharp(
        input,
        {
          failOn:
            'warning',

          limitInputPixels:
            40_000_000,
        },
      )
        .rotate()
        .resize({
          width:
            profile.dimension,

          height:
            profile.dimension,

          fit:
            'inside',

          withoutEnlargement:
            true,
        })
        .webp({
          quality:
            profile.quality,

          effort:
            4,
        })
        .toBuffer();

    smallest =
      output;

    if (
      output.length <=
      getOutputLimit(
        owner,
      )
    ) {
      return output;
    }
  }

  if (!smallest) {
    throw new Error(
      'Image encoding failed.',
    );
  }

  return smallest;
}

function getEncodingProfiles(
  owner:
    ImageOwner,
): EncodingProfile[] {
  if (
    owner ===
    'products'
  ) {
    return [
      {
        dimension:
          IMAGE_MAX_DIMENSION,
        quality:
          IMAGE_WEBP_QUALITY,
      },
      {
        dimension:
          IMAGE_MAX_DIMENSION,
        quality:
          72,
      },
      {
        dimension:
          1400,
        quality:
          74,
      },
      {
        dimension:
          1200,
        quality:
          70,
      },
      {
        dimension:
          1000,
        quality:
          66,
      },
    ];
  }

  if (
    owner ===
      'categories'
  ) {
    return [
      {
        dimension:
          CATALOG_IMAGE_MAX_DIMENSION,
        quality:
          IMAGE_WEBP_QUALITY,
      },
      {
        dimension:
          1000,
        quality:
          74,
      },
      {
        dimension:
          900,
        quality:
          68,
      },
    ];
  }

  return [
    {
      dimension:
        LOGO_IMAGE_MAX_DIMENSION,
      quality:
        IMAGE_WEBP_QUALITY,
    },
    {
      dimension:
        700,
      quality:
        74,
    },
    {
      dimension:
        600,
      quality:
        68,
    },
  ];
}

function getOutputLimit(
  owner:
    ImageOwner,
): number {
  if (
    owner ===
    'products'
  ) {
    return (
      IMAGE_OUTPUT_MAX_BYTES
    );
  }

  if (
    owner ===
    'categories'
  ) {
    return (
      CATALOG_IMAGE_OUTPUT_MAX_BYTES
    );
  }

  return (
    LOGO_IMAGE_OUTPUT_MAX_BYTES
  );
}

function slugify(
  value: string,
): string {
  const slug =
    value
      .normalize(
        'NFKD',
      )
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        '-',
      )
      .replace(
        /^-+|-+$/g,
        '',
      )
      .slice(
        0,
        80,
      );

  return (
    slug ||
    'image'
  );
}

function isManagedPath(
  value: string,
): boolean {
  return /^(products|profiles|stores|categories|brands)\/[a-zA-Z0-9-]+\//.test(
    value,
  );
}

function buildPublicUrl(
  bucketName:
    string,
  objectPath:
    string,
  publicBaseUrl:
    string,
): string {
  const encodedPath =
    objectPath
      .split('/')
      .map(
        (
          segment,
        ) =>
          encodeURIComponent(
            segment,
          ),
      )
      .join('/');

  if (
    publicBaseUrl
  ) {
    return (
      `${publicBaseUrl}/${encodedPath}`
    );
  }

  return (
    `https://storage.googleapis.com/${encodeURIComponent(
      bucketName,
    )}/${encodedPath}`
  );
}

function managedObjectPath(
  value:
    | string
    | null
    | undefined,
  bucketName:
    string,
  publicBaseUrl:
    string,
): string | undefined {
  if (!value) {
    return undefined;
  }

  if (
    isManagedPath(
      value,
    )
  ) {
    return value;
  }

  try {
    const url =
      new URL(
        value,
      );

    if (
      url.protocol !==
      'https:'
    ) {
      return undefined;
    }

    const googlePrefix =
      `/${bucketName}/`;

    if (
      url.hostname ===
        'storage.googleapis.com' &&
      url.pathname.startsWith(
        googlePrefix,
      )
    ) {
      const objectPath =
        decodeURIComponent(
          url.pathname.slice(
            googlePrefix.length,
          ),
        );

      return isManagedPath(
        objectPath,
      )
        ? objectPath
        : undefined;
    }

    if (
      publicBaseUrl
    ) {
      const base =
        new URL(
          publicBaseUrl,
        );

      if (
        url.origin ===
        base.origin
      ) {
        const basePath =
          base.pathname
            .replace(
              /\/+$/,
              '',
            );

        const requestedPath =
          url.pathname.startsWith(
            `${basePath}/`,
          )
            ? url.pathname.slice(
                basePath.length +
                  1,
              )
            : '';

        const objectPath =
          decodeURIComponent(
            requestedPath,
          );

        return isManagedPath(
          objectPath,
        )
          ? objectPath
          : undefined;
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}
