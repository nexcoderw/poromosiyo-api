import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@poromosiyo/db';

import type { SessionMetadata } from '../../../auth/types/auth.types';
import {
  CATALOG_ACTIVITY_ACTION,
  CATALOG_RESOURCE_TYPE,
} from '../catalog-activity.constants';
import type { ProductStoreAssignmentResult } from '../catalog.types';
import type { ProductStoreAssignmentDto } from '../dto/product-store.dto';

@Injectable()
export class AdminProductStoreService {
  private readonly logger = new Logger(AdminProductStoreService.name);

  constructor(private readonly prisma: PrismaService) {}

  async assignStore(
    dto: ProductStoreAssignmentDto,
    actorId: string,
    metadata: SessionMetadata,
  ): Promise<ProductStoreAssignmentResult> {
    const productIds = [...dto.productIds];

    const result = await this.prisma.$transaction(async (transaction) => {
      const store = await transaction.store.findUnique({
        where: {
          id: dto.storeId,
        },

        select: {
          id: true,
          name: true,
          isActive: true,
        },
      });

      if (!store) {
        throw new NotFoundException('Store not found.');
      }

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
          storeId: true,
        },
      });

      const foundIds = new Set(products.map((product) => product.id));

      const missing = productIds.filter(
        (productId) => !foundIds.has(productId),
      );

      if (missing.length > 0) {
        throw new NotFoundException({
          message: 'One or more selected products were not found.',

          productIds: missing,
        });
      }

      if (
        !store.isActive &&
        products.some((product) => product.status === 'ACTIVE')
      ) {
        throw new ConflictException(
          'Active products can only belong to an active store.',
        );
      }

      const changed = products.filter(
        (product) => product.storeId !== store.id,
      );

      if (changed.length > 0) {
        await transaction.product.updateMany({
          where: {
            id: {
              in: changed.map((product) => product.id),
            },
          },

          data: {
            storeId: store.id,
          },
        });

        await transaction.userActivity.createMany({
          data: changed.map((product) => ({
            subjectUserId: actorId,

            actorUserId: actorId,

            action: CATALOG_ACTIVITY_ACTION.PRODUCT_STORE_CHANGED,

            resourceType: CATALOG_RESOURCE_TYPE.PRODUCT,

            resourceId: product.id,

            description: `Assigned product ${product.name} to store ${store.name}`,

            ipAddress: metadata.ipAddress,

            userAgent: metadata.userAgent,

            metadata: {
              previousStoreId: product.storeId,

              newStoreId: store.id,

              newStoreName: store.name,
            },
          })),
        });
      }

      return {
        storeId: store.id,

        productIds,

        selectedCount: productIds.length,

        changedCount: changed.length,
      };
    });

    this.logger.log(
      `catalog.product.store actor=${actorId} store=${result.storeId} selected=${result.selectedCount} changed=${result.changedCount}`,
    );

    return result;
  }
}
