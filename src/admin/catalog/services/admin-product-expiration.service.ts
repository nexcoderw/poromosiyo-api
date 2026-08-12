import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@poromosiyo/db';

import type { SessionMetadata } from '../../../auth/types/auth.types';
import {
  CATALOG_ACTIVITY_ACTION,
  CATALOG_RESOURCE_TYPE,
} from '../catalog-activity.constants';
import type { ProductExpirationResult } from '../catalog.types';
import type { ProductExpirationDto } from '../dto/product-expiration.dto';
import { parseFutureProductExpiration } from '../utils/product-expiration.util';

@Injectable()
export class AdminProductExpirationService {
  private readonly logger = new Logger(AdminProductExpirationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async setExpiration(
    dto: ProductExpirationDto,
    actorId: string,
    metadata: SessionMetadata,
  ): Promise<ProductExpirationResult> {
    const productIds = [...dto.productIds];

    const expiresAt = parseFutureProductExpiration(dto.expiresAt);

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
          expiresAt: true,
        },
      });

      const found = new Set(products.map((product) => product.id));

      const missing = productIds.filter((productId) => !found.has(productId));

      if (missing.length > 0) {
        throw new NotFoundException({
          message: 'One or more selected products were not found.',

          productIds: missing,
        });
      }

      const changed = products.filter(
        (product) =>
          !product.expiresAt ||
          product.expiresAt.getTime() !== expiresAt.getTime(),
      );

      if (changed.length > 0) {
        const changedIds = changed.map((product) => product.id);

        await transaction.product.updateMany({
          where: {
            id: {
              in: changedIds,
            },
          },

          data: {
            expiresAt,
          },
        });

        await transaction.userActivity.createMany({
          data: changed.map((product) => ({
            subjectUserId: actorId,

            actorUserId: actorId,

            action: CATALOG_ACTIVITY_ACTION.PRODUCT_EXPIRATION_UPDATED,

            resourceType: CATALOG_RESOURCE_TYPE.PRODUCT,

            resourceId: product.id,

            description: `Updated product expiration: ${product.name}`,

            ipAddress: metadata.ipAddress,

            userAgent: metadata.userAgent,

            metadata: {
              previousExpiresAt: product.expiresAt?.toISOString() ?? null,

              expiresAt: expiresAt.toISOString(),
            },
          })),
        });
      }

      return {
        expiresAt,

        productIds,

        selectedCount: productIds.length,

        changedCount: changed.length,
      };
    });

    this.logger.log(
      `catalog.product.expiration actor=${actorId} selected=${result.selectedCount} changed=${result.changedCount}`,
    );

    return result;
  }
}
