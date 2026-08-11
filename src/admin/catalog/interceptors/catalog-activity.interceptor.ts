import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@poromosiyo/db';
import type { Observable } from 'rxjs';
import { concatMap } from 'rxjs';

import { getSessionMetadata } from '../../../auth/request-metadata';
import type { AuthenticatedRequest } from '../../../auth/types/authenticated-request.types';
import {
  CATALOG_ACTIVITY_ACTION,
  CATALOG_RESOURCE_TYPE,
} from '../catalog-activity.constants';

type ResourceIdSource = 'response' | 'id' | 'imageId';

type ActivityConfiguration = {
  action: string;
  resourceType: string;
  resourceIdSource: ResourceIdSource;
  description: string;
};

const ACTIVITY_CONFIGURATION: Record<
  string,
  Record<string, ActivityConfiguration>
> = {
  AdminCategoriesController: {
    create: {
      action: CATALOG_ACTIVITY_ACTION.CATEGORY_CREATED,
      resourceType: CATALOG_RESOURCE_TYPE.CATEGORY,
      resourceIdSource: 'response',
      description: 'Created a category.',
    },

    update: {
      action: CATALOG_ACTIVITY_ACTION.CATEGORY_UPDATED,
      resourceType: CATALOG_RESOURCE_TYPE.CATEGORY,
      resourceIdSource: 'id',
      description: 'Updated a category.',
    },

    remove: {
      action: CATALOG_ACTIVITY_ACTION.CATEGORY_DELETED,
      resourceType: CATALOG_RESOURCE_TYPE.CATEGORY,
      resourceIdSource: 'id',
      description: 'Deleted a category.',
    },
  },

  AdminBrandsController: {
    create: {
      action: CATALOG_ACTIVITY_ACTION.BRAND_CREATED,
      resourceType: CATALOG_RESOURCE_TYPE.BRAND,
      resourceIdSource: 'response',
      description: 'Created a brand.',
    },

    update: {
      action: CATALOG_ACTIVITY_ACTION.BRAND_UPDATED,
      resourceType: CATALOG_RESOURCE_TYPE.BRAND,
      resourceIdSource: 'id',
      description: 'Updated a brand.',
    },

    remove: {
      action: CATALOG_ACTIVITY_ACTION.BRAND_DELETED,
      resourceType: CATALOG_RESOURCE_TYPE.BRAND,
      resourceIdSource: 'id',
      description: 'Deleted a brand.',
    },
  },

  AdminProductsController: {
    create: {
      action: CATALOG_ACTIVITY_ACTION.PRODUCT_CREATED,
      resourceType: CATALOG_RESOURCE_TYPE.PRODUCT,
      resourceIdSource: 'response',
      description: 'Created a product.',
    },

    update: {
      action: CATALOG_ACTIVITY_ACTION.PRODUCT_UPDATED,
      resourceType: CATALOG_RESOURCE_TYPE.PRODUCT,
      resourceIdSource: 'id',
      description: 'Updated a product.',
    },

    remove: {
      action: CATALOG_ACTIVITY_ACTION.PRODUCT_DELETED,
      resourceType: CATALOG_RESOURCE_TYPE.PRODUCT,
      resourceIdSource: 'id',
      description: 'Deleted a draft product.',
    },
  },

  AdminProductImagesController: {
    create: {
      action: CATALOG_ACTIVITY_ACTION.PRODUCT_IMAGE_CREATED,
      resourceType: CATALOG_RESOURCE_TYPE.PRODUCT_IMAGE,
      resourceIdSource: 'response',
      description: 'Created a product image.',
    },

    update: {
      action: CATALOG_ACTIVITY_ACTION.PRODUCT_IMAGE_UPDATED,
      resourceType: CATALOG_RESOURCE_TYPE.PRODUCT_IMAGE,
      resourceIdSource: 'imageId',
      description: 'Updated a product image.',
    },

    remove: {
      action: CATALOG_ACTIVITY_ACTION.PRODUCT_IMAGE_DELETED,
      resourceType: CATALOG_RESOURCE_TYPE.PRODUCT_IMAGE,
      resourceIdSource: 'imageId',
      description: 'Deleted a product image.',
    },
  },
};

@Injectable()
export class CatalogActivityInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CatalogActivityInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const className = context.getClass().name;

    const handlerName = context.getHandler().name;

    const configuration = ACTIVITY_CONFIGURATION[className]?.[handlerName];

    if (!configuration) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return next.handle().pipe(
      concatMap(async (response: unknown) => {
        if (!request.auth) {
          return response;
        }

        const resourceId = resolveResourceId(
          configuration.resourceIdSource,
          request.params,
          response,
        );

        if (!resourceId) {
          this.logger.error(
            `Catalog activity skipped because the resource ID could not be resolved. controller=${className} handler=${handlerName}`,
          );

          return response;
        }

        const metadata = getSessionMetadata(request);

        try {
          await this.prisma.userActivity.create({
            data: {
              subjectUserId: request.auth.id,
              actorUserId: request.auth.id,
              action: configuration.action,
              resourceType: configuration.resourceType,
              resourceId,
              description: configuration.description,
              ipAddress: metadata.ipAddress,
              userAgent: metadata.userAgent,
            },
          });
        } catch (error: unknown) {
          this.logger.error(
            `Catalog activity persistence failed. action=${configuration.action} resource=${resourceId}`,
          );

          if (error instanceof Error) {
            this.logger.error(error.message);
          }
        }

        return response;
      }),
    );
  }
}

function resolveResourceId(
  source: ResourceIdSource,
  params: Record<string, string | string[]>,
  response: unknown,
): string | null {
  if (source !== 'response') {
    const candidate = params[source];

    return typeof candidate === 'string' ? candidate : null;
  }

  if (
    typeof response !== 'object' ||
    response === null ||
    !('id' in response)
  ) {
    return null;
  }

  const candidate = response as {
    id?: unknown;
  };

  return typeof candidate.id === 'string' ? candidate.id : null;
}
