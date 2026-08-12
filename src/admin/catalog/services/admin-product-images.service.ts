import { createCatalogActivityData } from '../utils/catalog-activity.util';
import {
  CATALOG_ACTIVITY_ACTION,
  CATALOG_RESOURCE_TYPE,
} from '../catalog-activity.constants';
import type { SessionMetadata } from '../../../auth/types/auth.types';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@poromosiyo/db';
import { ImageStorageService } from '../../../storage/image-storage.service';
import { PRODUCT_IMAGE_LIMIT } from '../../../storage/image-storage.constants';

import type {
  CreateProductImageDto,
  UpdateProductImageDto,
} from '../dto/product-image.dto';

@Injectable()
export class AdminProductImagesService {
  private readonly logger = new Logger(AdminProductImagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly imageStorage: ImageStorageService,
  ) {}

  async create(
    productId: string,
    file: Express.Multer.File,
    dto: CreateProductImageDto,
    actorId: string,
    metadata: SessionMetadata,
  ) {
    const product = await this.assertProductExists(productId);

    const existingCount = await this.prisma.productImage.count({
      where: {
        productId,
      },
    });

    const shouldBePrimary = existingCount === 0 || dto.isPrimary === true;

    if (existingCount >= PRODUCT_IMAGE_LIMIT) {
      throw new ConflictException('A product can have at most 10 images.');
    }

    const objectPath = await this.imageStorage.store({
      file,
      owner: 'products',
      ownerId: productId,
      slug: product.name,
    });

    let image;

    try {
      image = await this.prisma.$transaction(async (transaction) => {
        if (shouldBePrimary) {
          await transaction.productImage.updateMany({
            where: {
              productId,
              isPrimary: true,
            },

            data: {
              isPrimary: false,
            },
          });
        }

        const created = await transaction.productImage.create({
          data: {
            productId,

            url: objectPath,

            altText: normalizeNullableText(dto.altText),

            sortOrder: dto.sortOrder ?? existingCount,

            isPrimary: shouldBePrimary,
          },
        });

        await transaction.userActivity.create({
          data: createCatalogActivityData({
            actorId,

            action: CATALOG_ACTIVITY_ACTION.PRODUCT_IMAGE_CREATED,

            resourceType: CATALOG_RESOURCE_TYPE.PRODUCT_IMAGE,

            resourceId: created.id,

            description: `Created image for product ${productId}`,

            metadata,
          }),
        });

        return created;
      });
    } catch (error) {
      await this.imageStorage.deleteQuietly(objectPath);
      throw error;
    }

    this.logger.log(
      `catalog.product_image.created actor=${actorId} product=${productId} image=${image.id}`,
    );

    return image;
  }

  async update(
    productId: string,
    imageId: string,
    dto: UpdateProductImageDto,
    actorId: string,
    metadata: SessionMetadata,
  ) {
    const image = await this.prisma.productImage.findFirst({
      where: {
        id: imageId,

        productId,
      },

      include: {
        product: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!image) {
      throw new NotFoundException('Product image not found.');
    }

    if (
      dto.isPrimary === false &&
      image.isPrimary &&
      image.product.status === 'ACTIVE'
    ) {
      throw new ConflictException(
        'An active product must retain a primary image.',
      );
    }

    const updated = await this.prisma.$transaction(async (transaction) => {
      if (dto.isPrimary === true) {
        await transaction.productImage.updateMany({
          where: {
            productId,

            id: {
              not: imageId,
            },

            isPrimary: true,
          },

          data: {
            isPrimary: false,
          },
        });
      }

      const result = await transaction.productImage.update({
        where: {
          id: imageId,
        },

        data: {
          altText:
            dto.altText === undefined
              ? undefined
              : normalizeNullableText(dto.altText),

          sortOrder: dto.sortOrder,

          isPrimary: dto.isPrimary,
        },
      });

      await transaction.userActivity.create({
        data: createCatalogActivityData({
          actorId,

          action: CATALOG_ACTIVITY_ACTION.PRODUCT_IMAGE_UPDATED,

          resourceType: CATALOG_RESOURCE_TYPE.PRODUCT_IMAGE,

          resourceId: imageId,

          description: `Updated image for product ${productId}`,

          metadata,
        }),
      });

      return result;
    });

    this.logger.log(
      `catalog.product_image.updated actor=${actorId} product=${productId} image=${imageId}`,
    );

    return updated;
  }

  async remove(
    productId: string,
    imageId: string,
    actorId: string,
    metadata: SessionMetadata,
  ): Promise<void> {
    const image = await this.prisma.productImage.findFirst({
      where: {
        id: imageId,

        productId,
      },

      include: {
        product: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!image) {
      throw new NotFoundException('Product image not found.');
    }

    const count = await this.prisma.productImage.count({
      where: {
        productId,
      },
    });

    if (image.product.status === 'ACTIVE' && count <= 1) {
      throw new ConflictException(
        'The last image cannot be removed from an active product.',
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.productImage.delete({
        where: {
          id: imageId,
        },
      });

      if (image.isPrimary) {
        const replacement = await transaction.productImage.findFirst({
          where: {
            productId,
          },

          orderBy: [
            {
              sortOrder: 'asc',
            },
            {
              createdAt: 'asc',
            },
          ],

          select: {
            id: true,
          },
        });

        if (replacement) {
          await transaction.productImage.update({
            where: {
              id: replacement.id,
            },

            data: {
              isPrimary: true,
            },
          });
        }
      }

      await transaction.userActivity.create({
        data: createCatalogActivityData({
          actorId,

          action: CATALOG_ACTIVITY_ACTION.PRODUCT_IMAGE_DELETED,

          resourceType: CATALOG_RESOURCE_TYPE.PRODUCT_IMAGE,

          resourceId: imageId,

          description: `Deleted image from product ${productId}`,

          metadata,
        }),
      });
    });

    await this.imageStorage.deleteQuietly(image.url);

    this.logger.log(
      `catalog.product_image.deleted actor=${actorId} product=${productId} image=${imageId}`,
    );
  }

  private async assertProductExists(
    productId: string,
  ): Promise<{ name: string }> {
    const product = await this.prisma.product.findUnique({
      where: {
        id: productId,
      },
      select: {
        name: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    return product;
  }
}

function normalizeNullableText(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}
