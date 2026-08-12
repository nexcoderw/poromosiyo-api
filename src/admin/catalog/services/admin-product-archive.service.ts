import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@poromosiyo/db';

import type { SessionMetadata } from '../../../auth/types/auth.types';
import {
  CATALOG_ACTIVITY_ACTION,
  CATALOG_RESOURCE_TYPE,
} from '../catalog-activity.constants';
import type { ProductArchiveResult } from '../catalog.types';
import type { ProductArchiveDto } from '../dto/product-archive.dto';

@Injectable()
export class AdminProductArchiveService {
  private readonly logger = new Logger(AdminProductArchiveService.name);

  constructor(private readonly prisma: PrismaService) {}

  async setArchived(
    dto: ProductArchiveDto,
    actorId: string,
    metadata: SessionMetadata,
  ): Promise<ProductArchiveResult> {
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
        },
      });

      const foundIds = new Set(products.map((product) => product.id));

      const missingIds = productIds.filter(
        (productId) => !foundIds.has(productId),
      );

      if (missingIds.length > 0) {
        throw new NotFoundException({
          message: 'One or more selected products were not found.',

          productIds: missingIds,
        });
      }

      const changedProducts = products.filter((product) =>
        dto.archived
          ? product.status !== 'ARCHIVED'
          : product.status === 'ARCHIVED',
      );

      const changedIds = changedProducts.map((product) => product.id);

      if (changedIds.length > 0) {
        await transaction.product.updateMany({
          where: {
            id: {
              in: changedIds,
            },
          },

          data: dto.archived
            ? {
                status: 'ARCHIVED',
                publishedAt: null,
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

            action: dto.archived
              ? CATALOG_ACTIVITY_ACTION.PRODUCT_ARCHIVED
              : CATALOG_ACTIVITY_ACTION.PRODUCT_RESTORED,

            resourceType: CATALOG_RESOURCE_TYPE.PRODUCT,

            resourceId: product.id,

            description: dto.archived
              ? `Archived product: ${product.name}`
              : `Restored product to draft: ${product.name}`,

            ipAddress: metadata.ipAddress,

            userAgent: metadata.userAgent,
          })),
        });
      }

      return {
        archived: dto.archived,

        productIds,

        selectedCount: productIds.length,

        changedCount: changedProducts.length,
      };
    });

    this.logger.log(
      `catalog.product.archive actor=${actorId} archived=${dto.archived} selected=${result.selectedCount} changed=${result.changedCount}`,
    );

    return result;
  }
}
