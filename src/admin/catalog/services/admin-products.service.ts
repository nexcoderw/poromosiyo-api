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
  AdminProductResponse,
  PaginatedResult,
} from '../catalog.types';
import type {
  CatalogProductStatus,
} from '../catalog.constants';
import type {
  CreateProductDto,
  ListProductsDto,
  UpdateProductDto,
} from '../dto/product.dto';
import {
  assertDiscountedPrice,
  calculateDiscountPercentage,
  normalizeMoney,
} from '../utils/catalog-money.util';
import {
  isPrismaErrorCode,
} from '../utils/catalog-prisma-error.util';
import {
  normalizeCatalogSlug,
} from '../utils/catalog-slug.util';

@Injectable()
export class AdminProductsService {
  private readonly logger =
    new Logger(
      AdminProductsService.name,
    );

  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async list(
    query: ListProductsDto,
  ): Promise<
    PaginatedResult<
      AdminProductResponse
    >
  > {
    const page =
      query.page;

    const limit =
      query.limit;

    const search =
      query.search?.trim();

    const where = {
      ...(search
        ? {
            OR: [
              {
                name: {
                  contains:
                    search,
                },
              },
              {
                slug: {
                  contains:
                    search.toLowerCase(),
                },
              },
              {
                sku: {
                  contains:
                    search.toUpperCase(),
                },
              },
            ],
          }
        : {}),

      ...(query.status
        ? {
            status:
              query.status,
          }
        : {}),

      ...(query.categoryId
        ? {
            categoryId:
              query.categoryId,
          }
        : {}),

      ...(query.brandId
        ? {
            brandId:
              query.brandId,
          }
        : {}),

      ...(query.isFeatured ===
      undefined
        ? {}
        : {
            isFeatured:
              query.isFeatured,
          }),
    };

    const [
      total,
      products,
    ] =
      await this.prisma
        .$transaction([
          this.prisma
            .product
            .count({
              where,
            }),

          this.prisma
            .product
            .findMany({
              where,
              skip:
                (page - 1) *
                limit,
              take:
                limit,
              orderBy: {
                createdAt:
                  'desc',
              },
              include: {
                category: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    isActive:
                      true,
                  },
                },
                brand: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    isActive:
                      true,
                  },
                },
                images: {
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
                },
              },
            }),
        ]);

    return {
      items:
        products.map(
          serializeProduct,
        ),
      page,
      limit,
      total,
      totalPages:
        Math.ceil(
          total / limit,
        ),
    };
  }

  async get(
    id: string,
  ): Promise<AdminProductResponse> {
    const product =
      await this.prisma
        .product
        .findUnique({
          where: {
            id,
          },
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                isActive:
                  true,
              },
            },
            brand: {
              select: {
                id: true,
                name: true,
                slug: true,
                isActive:
                  true,
              },
            },
            images: {
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
            },
          },
        });

    if (!product) {
      throw new NotFoundException(
        'Product not found.',
      );
    }

    return serializeProduct(
      product,
    );
  }

  async create(
    dto: CreateProductDto,
    actorId: string,
  ): Promise<AdminProductResponse> {
    await this
      .assertCategoryExists(
        dto.categoryId,
      );

    if (dto.brandId) {
      await this
        .assertBrandExists(
          dto.brandId,
        );
    }

    const originalPrice =
      normalizeMoney(
        dto.originalPrice,
      );

    const sellingPrice =
      normalizeMoney(
        dto.sellingPrice,
      );

    assertDiscountedPrice(
      originalPrice,
      sellingPrice,
    );

    const slug =
      await this
        .resolveUniqueSlug(
          dto.slug ??
            dto.name,
          null,
        );

    const sku =
      normalizeSku(
        dto.sku,
      );

    try {
      const product =
        await this.prisma
          .product
          .create({
            data: {
              categoryId:
                dto.categoryId,
              brandId:
                dto.brandId ??
                null,
              name:
                dto.name.trim(),
              slug,
              sku,
              shortDescription:
                normalizeNullableText(
                  dto.shortDescription,
                ),
              description:
                normalizeNullableText(
                  dto.description,
                ),
              currency:
                normalizeCurrency(
                  dto.currency ??
                    'RWF',
                ),
              originalPrice,
              sellingPrice,
              status:
                'DRAFT',
              isFeatured:
                dto.isFeatured ??
                false,
            },
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  isActive:
                    true,
                },
              },
              brand: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  isActive:
                    true,
                },
              },
              images: {
                orderBy: {
                  sortOrder:
                    'asc',
                },
              },
            },
          });

      this.logger.log(
        `catalog.product.created actor=${actorId} product=${product.id}`,
      );

      return serializeProduct(
        product,
      );
    } catch (
      error: unknown
    ) {
      if (
        isPrismaErrorCode(
          error,
          'P2002',
        )
      ) {
        throw new ConflictException(
          'Product slug or SKU already exists.',
        );
      }

      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    actorId: string,
  ): Promise<AdminProductResponse> {
    const existing =
      await this.prisma
        .product
        .findUnique({
          where: {
            id,
          },
        });

    if (!existing) {
      throw new NotFoundException(
        'Product not found.',
      );
    }

    const categoryId =
      dto.categoryId ??
      existing.categoryId;

    const brandId =
      dto.brandId ===
        undefined
        ? existing.brandId
        : dto.brandId;

    await this
      .assertCategoryExists(
        categoryId,
      );

    if (brandId) {
      await this
        .assertBrandExists(
          brandId,
        );
    }

    const originalPrice =
      normalizeMoney(
        dto.originalPrice ??
          existing.originalPrice
            .toString(),
      );

    const sellingPrice =
      normalizeMoney(
        dto.sellingPrice ??
          existing.sellingPrice
            .toString(),
      );

    assertDiscountedPrice(
      originalPrice,
      sellingPrice,
    );

    const targetStatus =
      dto.status ??
      (
        existing.status as
          CatalogProductStatus
      );

    const effectiveDescription =
      dto.description ===
        undefined
        ? existing.description
        : normalizeNullableText(
            dto.description,
          );

    if (
      targetStatus ===
      'ACTIVE'
    ) {
      await this
        .assertCanActivate(
          id,
          categoryId,
          brandId,
          effectiveDescription,
        );
    }

    let slug:
      string | undefined;

    if (
      dto.slug !==
      undefined
    ) {
      slug =
        await this
          .resolveUniqueSlug(
            dto.slug,
            id,
          );
    }

    const publishedAt =
      determinePublishedAt(
        existing.status as
          CatalogProductStatus,
        targetStatus,
        existing.publishedAt,
      );

    try {
      const product =
        await this.prisma
          .product
          .update({
            where: {
              id,
            },
            data: {
              categoryId:
                dto.categoryId,
              brandId:
                dto.brandId,
              name:
                dto.name
                  ?.trim(),
              slug,
              sku:
                dto.sku
                  ? normalizeSku(
                      dto.sku,
                    )
                  : undefined,
              shortDescription:
                dto.shortDescription ===
                  undefined
                  ? undefined
                  : normalizeNullableText(
                      dto.shortDescription,
                    ),
              description:
                dto.description ===
                  undefined
                  ? undefined
                  : normalizeNullableText(
                      dto.description,
                    ),
              currency:
                dto.currency
                  ? normalizeCurrency(
                      dto.currency,
                    )
                  : undefined,
              originalPrice:
                dto.originalPrice ===
                  undefined
                  ? undefined
                  : originalPrice,
              sellingPrice:
                dto.sellingPrice ===
                  undefined
                  ? undefined
                  : sellingPrice,
              isFeatured:
                dto.isFeatured,
              status:
                dto.status,
              publishedAt,
            },
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  isActive:
                    true,
                },
              },
              brand: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  isActive:
                    true,
                },
              },
              images: {
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
              },
            },
          });

      this.logger.log(
        `catalog.product.updated actor=${actorId} product=${id}`,
      );

      return serializeProduct(
        product,
      );
    } catch (
      error: unknown
    ) {
      if (
        isPrismaErrorCode(
          error,
          'P2002',
        )
      ) {
        throw new ConflictException(
          'Product slug or SKU already exists.',
        );
      }

      throw error;
    }
  }

  async remove(
    id: string,
    actorId: string,
  ): Promise<void> {
    const product =
      await this.prisma
        .product
        .findUnique({
          where: {
            id,
          },
          select: {
            id: true,
            status:
              true,
          },
        });

    if (!product) {
      throw new NotFoundException(
        'Product not found.',
      );
    }

    if (
      product.status !==
      'DRAFT'
    ) {
      throw new ConflictException(
        'Only draft products can be permanently deleted. Archive published products instead.',
      );
    }

    await this.prisma
      .product
      .delete({
        where: {
          id,
        },
      });

    this.logger.log(
      `catalog.product.deleted actor=${actorId} product=${id}`,
    );
  }

  private async assertCategoryExists(
    id: string,
  ): Promise<void> {
    const category =
      await this.prisma
        .category
        .findUnique({
          where: {
            id,
          },
          select: {
            id: true,
          },
        });

    if (!category) {
      throw new NotFoundException(
        'Category not found.',
      );
    }
  }

  private async assertBrandExists(
    id: string,
  ): Promise<void> {
    const brand =
      await this.prisma
        .brand
        .findUnique({
          where: {
            id,
          },
          select: {
            id: true,
          },
        });

    if (!brand) {
      throw new NotFoundException(
        'Brand not found.',
      );
    }
  }

  private async assertCanActivate(
    productId: string,
    categoryId: string,
    brandId: string | null,
    description: string | null,
  ): Promise<void> {
    if (
      !description
    ) {
      throw new ConflictException(
        'Product description is required before activation.',
      );
    }

    const [
      category,
      brand,
      imageCount,
      primaryImageCount,
    ] =
      await this.prisma
        .$transaction([
          this.prisma
            .category
            .findUnique({
              where: {
                id:
                  categoryId,
              },
              select: {
                isActive:
                  true,
              },
            }),

          brandId
            ? this.prisma
                .brand
                .findUnique({
                  where: {
                    id:
                      brandId,
                  },
                  select: {
                    isActive:
                      true,
                  },
                })
            : this.prisma
                .brand
                .findFirst({
                  where: {
                    id: {
                      equals:
                        '__poromosiyo_no_brand__',
                    },
                  },
                  select: {
                    isActive:
                      true,
                  },
                }),

          this.prisma
            .productImage
            .count({
              where: {
                productId,
              },
            }),

          this.prisma
            .productImage
            .count({
              where: {
                productId,
                isPrimary:
                  true,
              },
            }),
        ]);

    if (
      !category ||
      !category.isActive
    ) {
      throw new ConflictException(
        'Product category must be active before product activation.',
      );
    }

    if (
      brandId &&
      (
        !brand ||
        !brand.isActive
      )
    ) {
      throw new ConflictException(
        'Product brand must be active before product activation.',
      );
    }

    if (
      imageCount < 1
    ) {
      throw new ConflictException(
        'At least one product image is required before activation.',
      );
    }

    if (
      primaryImageCount !==
      1
    ) {
      throw new ConflictException(
        'Exactly one primary product image is required before activation.',
      );
    }
  }

  private async resolveUniqueSlug(
    input: string,
    excludeId: string | null,
  ): Promise<string> {
    const base =
      normalizeCatalogSlug(
        input,
      );

    for (
      let index = 1;
      index <= 100;
      index += 1
    ) {
      const suffix =
        index === 1
          ? ''
          : `-${index}`;

      const candidate =
        `${base.slice(
          0,
          191 -
            suffix.length,
        )}${suffix}`;

      const existing =
        await this.prisma
          .product
          .findUnique({
            where: {
              slug:
                candidate,
            },
            select: {
              id: true,
            },
          });

      if (
        !existing ||
        existing.id ===
          excludeId
      ) {
        return candidate;
      }
    }

    throw new ConflictException(
      'Unable to create a unique product slug.',
    );
  }
}

function serializeProduct(
  product: {
    id: string;
    categoryId: string;
    brandId: string | null;
    name: string;
    slug: string;
    sku: string;
    shortDescription: string | null;
    description: string | null;
    currency: string;
    originalPrice: {
      toString(): string;
    };
    sellingPrice: {
      toString(): string;
    };
    status: string;
    isFeatured: boolean;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    category: {
      id: string;
      name: string;
      slug: string;
      isActive: boolean;
    };
    brand: {
      id: string;
      name: string;
      slug: string;
      isActive: boolean;
    } | null;
    images: Array<{
      id: string;
      url: string;
      altText: string | null;
      sortOrder: number;
      isPrimary: boolean;
      createdAt: Date;
    }>;
  },
): AdminProductResponse {
  const originalPrice =
    normalizeMoney(
      product.originalPrice
        .toString(),
    );

  const sellingPrice =
    normalizeMoney(
      product.sellingPrice
        .toString(),
    );

  return {
    id:
      product.id,
    categoryId:
      product.categoryId,
    brandId:
      product.brandId,
    name:
      product.name,
    slug:
      product.slug,
    sku:
      product.sku,
    shortDescription:
      product.shortDescription,
    description:
      product.description,
    currency:
      product.currency,
    originalPrice,
    sellingPrice,
    discountPercentage:
      calculateDiscountPercentage(
        originalPrice,
        sellingPrice,
      ),
    status:
      toProductStatus(
        product.status,
      ),
    isFeatured:
      product.isFeatured,
    publishedAt:
      product.publishedAt,
    createdAt:
      product.createdAt,
    updatedAt:
      product.updatedAt,
    category:
      product.category,
    brand:
      product.brand,
    images:
      product.images,
  };
}

function toProductStatus(
  value: string,
): CatalogProductStatus {
  if (
    value === 'DRAFT' ||
    value === 'ACTIVE' ||
    value === 'ARCHIVED'
  ) {
    return value;
  }

  throw new Error(
    `Unsupported product status: ${value}`,
  );
}

function normalizeSku(
  value: string,
): string {
  return value
    .trim()
    .toUpperCase();
}

function normalizeCurrency(
  value: string,
): string {
  return value
    .trim()
    .toUpperCase();
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

function determinePublishedAt(
  currentStatus:
    CatalogProductStatus,
  targetStatus:
    CatalogProductStatus,
  currentPublishedAt:
    Date | null,
): Date | null {
  if (
    targetStatus ===
    'ACTIVE'
  ) {
    if (
      currentStatus !==
      'ACTIVE'
    ) {
      return new Date();
    }

    return (
      currentPublishedAt ??
      new Date()
    );
  }

  if (
    targetStatus ===
    'DRAFT'
  ) {
    return null;
  }

  return currentPublishedAt;
}
