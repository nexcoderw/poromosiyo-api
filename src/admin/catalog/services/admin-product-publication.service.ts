import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@poromosiyo/db';

import {
  CATALOG_ACTIVITY_ACTION,
  CATALOG_RESOURCE_TYPE,
} from '../catalog-activity.constants';
import type { ProductPublicationResult } from '../catalog.types';
import type { ProductPublicationDto } from '../dto/product-publication.dto';
import type { SessionMetadata } from '../../../auth/types/auth.types';

type PublicationCandidate = {
  id: string;
  name: string;
  status: string;
  description: string | null;

  category: {
    isActive: boolean;
  };

  brand: {
    isActive: boolean;
  } | null;

  images: Array<{
    isPrimary: boolean;
  }>;
};

type PublicationFailure = {
  productId: string;
  productName: string;
  reasons: string[];
};

@Injectable()
export class AdminProductPublicationService {
  private readonly logger = new Logger(AdminProductPublicationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async setPublication(
    dto: ProductPublicationDto,
    actorId: string,
    metadata: SessionMetadata,
  ): Promise<ProductPublicationResult> {
    const productIds = [...dto.productIds];

    const result = await this.prisma.$transaction(async (transaction) => {
      const products = await transaction.product.findMany({
        where: {
          id: {
            in: productIds,
          },
        },
        select: {
          id: true,
          name: true,
          status: true,
          description: true,

          category: {
            select: {
              isActive: true,
            },
          },

          brand: {
            select: {
              isActive: true,
            },
          },

          images: {
            select: {
              isPrimary: true,
            },
          },
        },
      });

      assertAllProductsExist(productIds, products);

      assertNoArchivedProducts(products);

      if (dto.published) {
        assertPublicationReady(products);
      }

      const changedProducts = products.filter((product) =>
        dto.published
          ? product.status !== 'ACTIVE'
          : product.status === 'ACTIVE',
      );

      const changedIds = changedProducts.map((product) => product.id);

      if (changedIds.length > 0) {
        const now = new Date();

        await transaction.product.updateMany({
          where: {
            id: {
              in: changedIds,
            },
          },

          data: dto.published
            ? {
                status: 'ACTIVE',
                publishedAt: now,
              }
            : {
                status: 'DRAFT',
                publishedAt: null,
              },
        });

        await transaction.userActivity.createMany({
          data: changedProducts.map((product) => ({
            subjectUserId: actorId,
            actorUserId: actorId,

            action: dto.published
              ? CATALOG_ACTIVITY_ACTION.PRODUCT_PUBLISHED
              : CATALOG_ACTIVITY_ACTION.PRODUCT_UNPUBLISHED,

            resourceType: CATALOG_RESOURCE_TYPE.PRODUCT,

            resourceId: product.id,

            description: dto.published
              ? `Published product: ${product.name}`
              : `Unpublished product: ${product.name}`,

            ipAddress: metadata.ipAddress,

            userAgent: metadata.userAgent,
          })),
        });
      }

      return {
        published: dto.published,

        productIds,

        selectedCount: productIds.length,

        changedCount: changedProducts.length,
      };
    });

    this.logger.log(
      `catalog.product.publication actor=${actorId} published=${dto.published} selected=${result.selectedCount} changed=${result.changedCount}`,
    );

    return result;
  }
}

function assertAllProductsExist(
  productIds: readonly string[],
  products: readonly PublicationCandidate[],
): void {
  const found = new Set(products.map((product) => product.id));

  const missing = productIds.filter((productId) => !found.has(productId));

  if (missing.length > 0) {
    throw new NotFoundException({
      message: 'One or more selected products were not found.',

      productIds: missing,
    });
  }
}

function assertNoArchivedProducts(
  products: readonly PublicationCandidate[],
): void {
  const archived = products
    .filter((product) => product.status === 'ARCHIVED')
    .map((product) => product.id);

  if (archived.length > 0) {
    throw new ConflictException({
      message: 'Archived products cannot be published or unpublished.',

      productIds: archived,
    });
  }
}

function assertPublicationReady(
  products: readonly PublicationCandidate[],
): void {
  const failures: PublicationFailure[] = [];

  for (const product of products) {
    const reasons: string[] = [];

    if (!product.description?.trim()) {
      reasons.push('Product description is required.');
    }

    if (!product.category.isActive) {
      reasons.push('Product category must be active.');
    }

    if (product.brand && !product.brand.isActive) {
      reasons.push('Product brand must be active.');
    }

    if (product.images.length < 1) {
      reasons.push('At least one product image is required.');
    }

    const primaryImages = product.images.filter(
      (image) => image.isPrimary,
    ).length;

    if (primaryImages !== 1) {
      reasons.push('Exactly one primary product image is required.');
    }

    if (reasons.length > 0) {
      failures.push({
        productId: product.id,

        productName: product.name,

        reasons,
      });
    }
  }

  if (failures.length > 0) {
    throw new ConflictException({
      message: 'One or more products are not ready for publication.',

      products: failures,
    });
  }
}
