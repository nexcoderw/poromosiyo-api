import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaService,
} from '@poromosiyo/db';

import type {
  CreateProductImageDto,
  UpdateProductImageDto,
} from '../dto/product-image.dto';

@Injectable()
export class AdminProductImagesService {
  private readonly logger =
    new Logger(
      AdminProductImagesService.name,
    );

  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async create(
    productId: string,
    dto: CreateProductImageDto,
    actorId: string,
  ) {
    await this
      .assertProductExists(
        productId,
      );

    const existingCount =
      await this.prisma
        .productImage
        .count({
          where: {
            productId,
          },
        });

    const shouldBePrimary =
      existingCount === 0 ||
      dto.isPrimary ===
        true;

    const image =
      await this.prisma
        .$transaction(
          async (
            transaction,
          ) => {
            if (
              shouldBePrimary
            ) {
              await transaction
                .productImage
                .updateMany({
                  where: {
                    productId,
                    isPrimary:
                      true,
                  },
                  data: {
                    isPrimary:
                      false,
                  },
                });
            }

            return transaction
              .productImage
              .create({
                data: {
                  productId,
                  url:
                    dto.url,
                  altText:
                    normalizeNullableText(
                      dto.altText,
                    ),
                  sortOrder:
                    dto.sortOrder ??
                    existingCount,
                  isPrimary:
                    shouldBePrimary,
                },
              });
          },
        );

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
  ) {
    const image =
      await this.prisma
        .productImage
        .findFirst({
          where: {
            id:
              imageId,
            productId,
          },
          include: {
            product: {
              select: {
                status:
                  true,
              },
            },
          },
        });

    if (!image) {
      throw new NotFoundException(
        'Product image not found.',
      );
    }

    if (
      dto.isPrimary ===
        false &&
      image.isPrimary &&
      image.product.status ===
        'ACTIVE'
    ) {
      throw new ConflictException(
        'An active product must retain a primary image.',
      );
    }

    const updated =
      await this.prisma
        .$transaction(
          async (
            transaction,
          ) => {
            if (
              dto.isPrimary ===
              true
            ) {
              await transaction
                .productImage
                .updateMany({
                  where: {
                    productId,
                    id: {
                      not:
                        imageId,
                    },
                    isPrimary:
                      true,
                  },
                  data: {
                    isPrimary:
                      false,
                  },
                });
            }

            return transaction
              .productImage
              .update({
                where: {
                  id:
                    imageId,
                },
                data: {
                  url:
                    dto.url,
                  altText:
                    dto.altText ===
                      undefined
                      ? undefined
                      : normalizeNullableText(
                          dto.altText,
                        ),
                  sortOrder:
                    dto.sortOrder,
                  isPrimary:
                    dto.isPrimary,
                },
              });
          },
        );

    this.logger.log(
      `catalog.product_image.updated actor=${actorId} product=${productId} image=${imageId}`,
    );

    return updated;
  }

  async remove(
    productId: string,
    imageId: string,
    actorId: string,
  ): Promise<void> {
    const image =
      await this.prisma
        .productImage
        .findFirst({
          where: {
            id:
              imageId,
            productId,
          },
          include: {
            product: {
              select: {
                status:
                  true,
              },
            },
          },
        });

    if (!image) {
      throw new NotFoundException(
        'Product image not found.',
      );
    }

    const count =
      await this.prisma
        .productImage
        .count({
          where: {
            productId,
          },
        });

    if (
      image.product.status ===
        'ACTIVE' &&
      count <= 1
    ) {
      throw new ConflictException(
        'The last image cannot be removed from an active product.',
      );
    }

    await this.prisma
      .$transaction(
        async (
          transaction,
        ) => {
          await transaction
            .productImage
            .delete({
              where: {
                id:
                  imageId,
              },
            });

          if (
            image.isPrimary
          ) {
            const replacement =
              await transaction
                .productImage
                .findFirst({
                  where: {
                    productId,
                  },
                  orderBy: [
                    {
                      sortOrder:
                        'asc',
                    },
                    {
                      createdAt:
                        'asc',
                    },
                  ],
                  select: {
                    id:
                      true,
                  },
                });

            if (replacement) {
              await transaction
                .productImage
                .update({
                  where: {
                    id:
                      replacement.id,
                  },
                  data: {
                    isPrimary:
                      true,
                  },
                });
            }
          }
        },
      );

    this.logger.log(
      `catalog.product_image.deleted actor=${actorId} product=${productId} image=${imageId}`,
    );
  }

  private async assertProductExists(
    productId: string,
  ): Promise<void> {
    const product =
      await this.prisma
        .product
        .findUnique({
          where: {
            id:
              productId,
          },
          select: {
            id:
              true,
          },
        });

    if (!product) {
      throw new NotFoundException(
        'Product not found.',
      );
    }
  }
}

function normalizeNullableText(
  value:
    | string
    | null
    | undefined,
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const trimmed =
    value.trim();

  return trimmed ||
    null;
}
