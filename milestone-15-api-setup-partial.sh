python3 <<'PY'
from pathlib import Path
import json
import re

ROOT = Path.cwd()
DB_SCHEMA = ROOT.parent / "db/prisma/schema.prisma"

required = [
    ROOT / "package.json",
    ROOT / "src/admin/catalog/admin-catalog.module.ts",
    ROOT / "src/admin/catalog/controllers/admin-products.controller.ts",
    ROOT / "src/admin/catalog/services/admin-products.service.ts",
    ROOT / "src/admin/catalog/dto/product.dto.ts",
    ROOT / "src/auth/request-metadata.ts",
    DB_SCHEMA,
]

missing = [
    str(path)
    for path in required
    if not path.exists()
]

if missing:
    print("ERROR: Required foundation files are missing.")
    for item in missing:
        print(f"  - {item}")
    raise SystemExit(1)

db_schema = DB_SCHEMA.read_text(
    encoding="utf-8",
)

if (
    "SUPERADMIN" not in db_schema
    or "model UserActivity {" not in db_schema
):
    print(
        "ERROR: Local Milestone 14 is not complete."
    )
    print(
        "Expected ../db/prisma/schema.prisma to contain:"
    )
    print("  - UserRole.SUPERADMIN")
    print("  - model UserActivity")
    print()
    print(
        "Complete/apply Milestone 14 before Milestone 15."
    )
    raise SystemExit(1)


def write(path: str, content: str):
    target = ROOT / path
    target.parent.mkdir(
        parents=True,
        exist_ok=True,
    )
    target.write_text(
        content.strip() + "\n",
        encoding="utf-8",
    )
    print(f"Created/updated: {path}")


def append_section(
    path: str,
    marker: str,
    content: str,
):
    target = ROOT / path

    if not target.exists():
        return

    existing = target.read_text(
        encoding="utf-8",
    )

    if marker in existing:
        print(f"Already documented: {path}")
        return

    target.write_text(
        existing.rstrip()
        + "\n\n"
        + content.strip()
        + "\n",
        encoding="utf-8",
    )

    print(f"Updated: {path}")


# ------------------------------------------------------------
# package.json
# ------------------------------------------------------------

package_path = ROOT / "package.json"

pkg = json.loads(
    package_path.read_text(
        encoding="utf-8",
    )
)

scripts = pkg.setdefault(
    "scripts",
    {},
)

scripts["milestone:15:check"] = (
    "npm --prefix ../db run milestone:14:check && "
    "npm run ci:check && "
    "npm run api:db-check && "
    "npm run test:e2e"
)

package_path.write_text(
    json.dumps(
        pkg,
        indent=2,
    ) + "\n",
    encoding="utf-8",
)

print("Updated: package.json")


# ------------------------------------------------------------
# Catalog activity constants
# ------------------------------------------------------------

write(
    "src/admin/catalog/catalog-activity.constants.ts",
    r'''
export const CATALOG_ACTIVITY_ACTION = {
  CATEGORY_CREATED:
    'CATEGORY_CREATED',
  CATEGORY_UPDATED:
    'CATEGORY_UPDATED',
  CATEGORY_DELETED:
    'CATEGORY_DELETED',

  BRAND_CREATED:
    'BRAND_CREATED',
  BRAND_UPDATED:
    'BRAND_UPDATED',
  BRAND_DELETED:
    'BRAND_DELETED',

  PRODUCT_CREATED:
    'PRODUCT_CREATED',
  PRODUCT_UPDATED:
    'PRODUCT_UPDATED',
  PRODUCT_DELETED:
    'PRODUCT_DELETED',

  PRODUCT_IMAGE_CREATED:
    'PRODUCT_IMAGE_CREATED',
  PRODUCT_IMAGE_UPDATED:
    'PRODUCT_IMAGE_UPDATED',
  PRODUCT_IMAGE_DELETED:
    'PRODUCT_IMAGE_DELETED',

  PRODUCT_PUBLISHED:
    'PRODUCT_PUBLISHED',
  PRODUCT_UNPUBLISHED:
    'PRODUCT_UNPUBLISHED',
} as const;

export const CATALOG_RESOURCE_TYPE = {
  CATEGORY: 'CATEGORY',
  BRAND: 'BRAND',
  PRODUCT: 'PRODUCT',
  PRODUCT_IMAGE: 'PRODUCT_IMAGE',
} as const;
'''
)


# ------------------------------------------------------------
# Publication DTO
# ------------------------------------------------------------

write(
    "src/admin/catalog/dto/product-publication.dto.ts",
    r'''
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsUUID,
} from 'class-validator';

export class ProductPublicationDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', {
    each: true,
  })
  productIds!: string[];

  @IsBoolean()
  published!: boolean;
}
'''
)


# ------------------------------------------------------------
# Response type
# ------------------------------------------------------------

types_path = ROOT / "src/admin/catalog/catalog.types.ts"

types_content = types_path.read_text(
    encoding="utf-8",
)

publication_type = r'''

export type ProductPublicationResult = {
  published: boolean;
  productIds: string[];
  selectedCount: number;
  changedCount: number;
};
'''

if (
    "ProductPublicationResult"
    not in types_content
):
    types_path.write_text(
        types_content.rstrip()
        + publication_type
        + "\n",
        encoding="utf-8",
    )

    print(
        "Updated: src/admin/catalog/catalog.types.ts"
    )


# ------------------------------------------------------------
# Activity interceptor
# ------------------------------------------------------------

write(
    "src/admin/catalog/interceptors/catalog-activity.interceptor.ts",
    r'''
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  Logger,
} from '@nestjs/common';
import {
  PrismaService,
} from '@poromosiyo/db';
import type {
  Observable,
} from 'rxjs';
import {
  concatMap,
} from 'rxjs';

import {
  getSessionMetadata,
} from '../../../auth/request-metadata';
import type {
  AuthenticatedRequest,
} from '../../../auth/types/authenticated-request.types';
import {
  CATALOG_ACTIVITY_ACTION,
  CATALOG_RESOURCE_TYPE,
} from '../catalog-activity.constants';

type ResourceIdSource =
  | 'response'
  | 'id'
  | 'imageId';

type ActivityConfiguration = {
  action: string;
  resourceType: string;
  resourceIdSource: ResourceIdSource;
  description: string;
};

const ACTIVITY_CONFIGURATION:
  Record<
    string,
    Record<
      string,
      ActivityConfiguration
    >
  > = {
    AdminCategoriesController: {
      create: {
        action:
          CATALOG_ACTIVITY_ACTION
            .CATEGORY_CREATED,
        resourceType:
          CATALOG_RESOURCE_TYPE
            .CATEGORY,
        resourceIdSource:
          'response',
        description:
          'Created a category.',
      },

      update: {
        action:
          CATALOG_ACTIVITY_ACTION
            .CATEGORY_UPDATED,
        resourceType:
          CATALOG_RESOURCE_TYPE
            .CATEGORY,
        resourceIdSource:
          'id',
        description:
          'Updated a category.',
      },

      remove: {
        action:
          CATALOG_ACTIVITY_ACTION
            .CATEGORY_DELETED,
        resourceType:
          CATALOG_RESOURCE_TYPE
            .CATEGORY,
        resourceIdSource:
          'id',
        description:
          'Deleted a category.',
      },
    },

    AdminBrandsController: {
      create: {
        action:
          CATALOG_ACTIVITY_ACTION
            .BRAND_CREATED,
        resourceType:
          CATALOG_RESOURCE_TYPE
            .BRAND,
        resourceIdSource:
          'response',
        description:
          'Created a brand.',
      },

      update: {
        action:
          CATALOG_ACTIVITY_ACTION
            .BRAND_UPDATED,
        resourceType:
          CATALOG_RESOURCE_TYPE
            .BRAND,
        resourceIdSource:
          'id',
        description:
          'Updated a brand.',
      },

      remove: {
        action:
          CATALOG_ACTIVITY_ACTION
            .BRAND_DELETED,
        resourceType:
          CATALOG_RESOURCE_TYPE
            .BRAND,
        resourceIdSource:
          'id',
        description:
          'Deleted a brand.',
      },
    },

    AdminProductsController: {
      create: {
        action:
          CATALOG_ACTIVITY_ACTION
            .PRODUCT_CREATED,
        resourceType:
          CATALOG_RESOURCE_TYPE
            .PRODUCT,
        resourceIdSource:
          'response',
        description:
          'Created a product.',
      },

      update: {
        action:
          CATALOG_ACTIVITY_ACTION
            .PRODUCT_UPDATED,
        resourceType:
          CATALOG_RESOURCE_TYPE
            .PRODUCT,
        resourceIdSource:
          'id',
        description:
          'Updated a product.',
      },

      remove: {
        action:
          CATALOG_ACTIVITY_ACTION
            .PRODUCT_DELETED,
        resourceType:
          CATALOG_RESOURCE_TYPE
            .PRODUCT,
        resourceIdSource:
          'id',
        description:
          'Deleted a draft product.',
      },
    },

    AdminProductImagesController: {
      create: {
        action:
          CATALOG_ACTIVITY_ACTION
            .PRODUCT_IMAGE_CREATED,
        resourceType:
          CATALOG_RESOURCE_TYPE
            .PRODUCT_IMAGE,
        resourceIdSource:
          'response',
        description:
          'Created a product image.',
      },

      update: {
        action:
          CATALOG_ACTIVITY_ACTION
            .PRODUCT_IMAGE_UPDATED,
        resourceType:
          CATALOG_RESOURCE_TYPE
            .PRODUCT_IMAGE,
        resourceIdSource:
          'imageId',
        description:
          'Updated a product image.',
      },

      remove: {
        action:
          CATALOG_ACTIVITY_ACTION
            .PRODUCT_IMAGE_DELETED,
        resourceType:
          CATALOG_RESOURCE_TYPE
            .PRODUCT_IMAGE,
        resourceIdSource:
          'imageId',
        description:
          'Deleted a product image.',
      },
    },
  };

@Injectable()
export class CatalogActivityInterceptor
  implements NestInterceptor
{
  private readonly logger =
    new Logger(
      CatalogActivityInterceptor.name,
    );

  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const className =
      context
        .getClass()
        .name;

    const handlerName =
      context
        .getHandler()
        .name;

    const configuration =
      ACTIVITY_CONFIGURATION[
        className
      ]?.[
        handlerName
      ];

    if (!configuration) {
      return next.handle();
    }

    const request =
      context
        .switchToHttp()
        .getRequest<
          AuthenticatedRequest
        >();

    return next
      .handle()
      .pipe(
        concatMap(
          async (
            response: unknown,
          ) => {
            if (!request.auth) {
              return response;
            }

            const resourceId =
              resolveResourceId(
                configuration
                  .resourceIdSource,
                request.params,
                response,
              );

            if (!resourceId) {
              this.logger.error(
                `Catalog activity skipped because the resource ID could not be resolved. controller=${className} handler=${handlerName}`,
              );

              return response;
            }

            const metadata =
              getSessionMetadata(
                request,
              );

            try {
              await this.prisma
                .userActivity
                .create({
                  data: {
                    subjectUserId:
                      request.auth.id,
                    actorUserId:
                      request.auth.id,
                    action:
                      configuration.action,
                    resourceType:
                      configuration
                        .resourceType,
                    resourceId,
                    description:
                      configuration
                        .description,
                    ipAddress:
                      metadata.ipAddress,
                    userAgent:
                      metadata.userAgent,
                  },
                });
            } catch (
              error: unknown
            ) {
              this.logger.error(
                `Catalog activity persistence failed. action=${configuration.action} resource=${resourceId}`,
              );

              if (
                error instanceof
                Error
              ) {
                this.logger.error(
                  error.message,
                );
              }
            }

            return response;
          },
        ),
      );
  }
}

function resolveResourceId(
  source: ResourceIdSource,
  params:
    Record<
      string,
      string | string[]
    >,
  response: unknown,
): string | null {
  if (
    source !==
    'response'
  ) {
    const candidate =
      params[source];

    return typeof candidate ===
      'string'
      ? candidate
      : null;
  }

  if (
    typeof response !==
      'object' ||
    response === null ||
    !('id' in response)
  ) {
    return null;
  }

  const candidate =
    response as {
      id?: unknown;
    };

  return typeof candidate.id ===
    'string'
    ? candidate.id
    : null;
}
'''
)


# ------------------------------------------------------------
# Publication service
# ------------------------------------------------------------

write(
    "src/admin/catalog/services/admin-product-publication.service.ts",
    r'''
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PrismaService,
} from '@poromosiyo/db';

import {
  CATALOG_ACTIVITY_ACTION,
  CATALOG_RESOURCE_TYPE,
} from '../catalog-activity.constants';
import type {
  ProductPublicationResult,
} from '../catalog.types';
import type {
  ProductPublicationDto,
} from '../dto/product-publication.dto';
import type {
  SessionMetadata,
} from '../../../auth/types/auth.types';

type PublicationCandidate = {
  id: string;
  name: string;
  status: string;
  description:
    | string
    | null;

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
  private readonly logger =
    new Logger(
      AdminProductPublicationService.name,
    );

  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async setPublication(
    dto: ProductPublicationDto,
    actorId: string,
    metadata: SessionMetadata,
  ): Promise<ProductPublicationResult> {
    const productIds =
      [...dto.productIds];

    const result =
      await this.prisma
        .$transaction(
          async (
            transaction,
          ) => {
            const products =
              await transaction
                .product
                .findMany({
                  where: {
                    id: {
                      in:
                        productIds,
                    },
                  },
                  select: {
                    id: true,
                    name: true,
                    status:
                      true,
                    description:
                      true,

                    category: {
                      select: {
                        isActive:
                          true,
                      },
                    },

                    brand: {
                      select: {
                        isActive:
                          true,
                      },
                    },

                    images: {
                      select: {
                        isPrimary:
                          true,
                      },
                    },
                  },
                });

            assertAllProductsExist(
              productIds,
              products,
            );

            assertNoArchivedProducts(
              products,
            );

            if (dto.published) {
              assertPublicationReady(
                products,
              );
            }

            const changedProducts =
              products.filter(
                (product) =>
                  dto.published
                    ? product.status !==
                      'ACTIVE'
                    : product.status ===
                      'ACTIVE',
              );

            const changedIds =
              changedProducts.map(
                (product) =>
                  product.id,
              );

            if (
              changedIds.length >
              0
            ) {
              const now =
                new Date();

              await transaction
                .product
                .updateMany({
                  where: {
                    id: {
                      in:
                        changedIds,
                    },
                  },

                  data:
                    dto.published
                      ? {
                          status:
                            'ACTIVE',
                          publishedAt:
                            now,
                        }
                      : {
                          status:
                            'DRAFT',
                          publishedAt:
                            null,
                        },
                });

              await transaction
                .userActivity
                .createMany({
                  data:
                    changedProducts.map(
                      (
                        product,
                      ) => ({
                        subjectUserId:
                          actorId,
                        actorUserId:
                          actorId,

                        action:
                          dto.published
                            ? CATALOG_ACTIVITY_ACTION
                                .PRODUCT_PUBLISHED
                            : CATALOG_ACTIVITY_ACTION
                                .PRODUCT_UNPUBLISHED,

                        resourceType:
                          CATALOG_RESOURCE_TYPE
                            .PRODUCT,

                        resourceId:
                          product.id,

                        description:
                          dto.published
                            ? `Published product: ${product.name}`
                            : `Unpublished product: ${product.name}`,

                        ipAddress:
                          metadata.ipAddress,

                        userAgent:
                          metadata.userAgent,
                      }),
                    ),
                });
            }

            return {
              published:
                dto.published,

              productIds,

              selectedCount:
                productIds.length,

              changedCount:
                changedProducts
                  .length,
            };
          },
        );

    this.logger.log(
      `catalog.product.publication actor=${actorId} published=${dto.published} selected=${result.selectedCount} changed=${result.changedCount}`,
    );

    return result;
  }
}

function assertAllProductsExist(
  productIds: readonly string[],
  products:
    readonly PublicationCandidate[],
): void {
  const found =
    new Set(
      products.map(
        (product) =>
          product.id,
      ),
    );

  const missing =
    productIds.filter(
      (productId) =>
        !found.has(
          productId,
        ),
    );

  if (
    missing.length >
    0
  ) {
    throw new NotFoundException({
      message:
        'One or more selected products were not found.',

      productIds:
        missing,
    });
  }
}

function assertNoArchivedProducts(
  products:
    readonly PublicationCandidate[],
): void {
  const archived =
    products
      .filter(
        (product) =>
          product.status ===
          'ARCHIVED',
      )
      .map(
        (product) =>
          product.id,
      );

  if (
    archived.length >
    0
  ) {
    throw new ConflictException({
      message:
        'Archived products cannot be published or unpublished.',

      productIds:
        archived,
    });
  }
}

function assertPublicationReady(
  products:
    readonly PublicationCandidate[],
): void {
  const failures:
    PublicationFailure[] = [];

  for (
    const product
    of products
  ) {
    const reasons:
      string[] = [];

    if (
      !product.description
        ?.trim()
    ) {
      reasons.push(
        'Product description is required.',
      );
    }

    if (
      !product.category
        .isActive
    ) {
      reasons.push(
        'Product category must be active.',
      );
    }

    if (
      product.brand &&
      !product.brand
        .isActive
    ) {
      reasons.push(
        'Product brand must be active.',
      );
    }

    if (
      product.images.length <
      1
    ) {
      reasons.push(
        'At least one product image is required.',
      );
    }

    const primaryImages =
      product.images.filter(
        (image) =>
          image.isPrimary,
      ).length;

    if (
      primaryImages !==
      1
    ) {
      reasons.push(
        'Exactly one primary product image is required.',
      );
    }

    if (
      reasons.length > 0
    ) {
      failures.push({
        productId:
          product.id,

        productName:
          product.name,

        reasons,
      });
    }
  }

  if (
    failures.length >
    0
  ) {
    throw new ConflictException({
      message:
        'One or more products are not ready for publication.',

      products:
        failures,
    });
  }
}
'''
)


# ------------------------------------------------------------
# Remove publication status from generic Product PATCH DTO
# ------------------------------------------------------------

dto_path = (
    ROOT
    / "src/admin/catalog/dto/product.dto.ts"
)

dto = dto_path.read_text(
    encoding="utf-8",
)

update_dto_pattern = re.compile(
    r"(export class UpdateProductDto\s*\{)"
    r"(.*?)"
    r"(\n\}\n\nexport class ListProductsDto)",
    flags=re.S,
)

update_dto_match = update_dto_pattern.search(
    dto,
)

if not update_dto_match:
    raise SystemExit(
        "ERROR: Could not locate UpdateProductDto."
    )

update_dto_body, count = re.subn(
    r"\n\s*@IsOptional\(\)"
    r"\s*\n\s*@IsIn\(PRODUCT_STATUSES\)"
    r"\s*\n\s*status\?: CatalogProductStatus;\s*",
    "\n",
    update_dto_match.group(2),
    count=1,
)

if (
    count == 0
    and "status?: CatalogProductStatus"
    in update_dto_match.group(2)
):
    raise SystemExit(
        "ERROR: Could not safely remove status from UpdateProductDto."
    )

dto = (
    dto[:update_dto_match.start()]
    + update_dto_match.group(1)
    + update_dto_body
    + update_dto_match.group(3)
    + dto[update_dto_match.end():]
)

dto_path.write_text(
    dto.rstrip() + "\n",
    encoding="utf-8",
)

print(
    "Updated: src/admin/catalog/dto/product.dto.ts"
)


# ------------------------------------------------------------
# Remove publication behavior from generic product update service
# ------------------------------------------------------------

service_path = (
    ROOT
    / "src/admin/catalog/services/admin-products.service.ts"
)

service = service_path.read_text(
    encoding="utf-8",
)


# Remove targetStatus + activation block.
service, count = re.subn(
    r"\n    const targetStatus =.*?\n    let slug:",
    "\n\n    let slug:",
    service,
    count=1,
    flags=re.S,
)

if (
    count == 0 and
    "const targetStatus =" in service
):
    raise SystemExit(
        "ERROR: Could not safely remove product status workflow from AdminProductsService."
    )


# Remove publishedAt calculation.
service, count = re.subn(
    r"\n    const publishedAt =.*?\n    try:",
    "\n\n    try:",
    service,
    count=1,
    flags=re.S,
)

if (
    count == 0
    and "const publishedAt =" in service
):
    raise SystemExit(
        "ERROR: Could not safely remove publishedAt calculation."
    )


# Remove status and publishedAt update fields.
service, count = re.subn(
    r"\n\s+status:\s*dto\.status,"
    r"\s*\n\s+publishedAt,",
    "",
    service,
    count=1,
    flags=0,
)

if (
    count == 0
    and "dto.status" in service
):
    raise SystemExit(
        "ERROR: Could not safely remove publication update fields."
    )


# Remove old determinePublishedAt helper.
service = re.sub(
    r"\nfunction determinePublishedAt\(.*?\n\}\s*$",
    "\n",
    service,
    count=1,
    flags=re.S,
)

service_path.write_text(
    service.rstrip() + "\n",
    encoding="utf-8",
)

print(
    "Updated: src/admin/catalog/services/admin-products.service.ts"
)


# ------------------------------------------------------------
# Products controller
# Static /publication declared before /:id.
# ------------------------------------------------------------

write(
    "src/admin/catalog/controllers/admin-products.controller.ts",
    r'''
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  Request,
} from 'express';

import {
  CurrentUser,
} from '../../../auth/decorators/current-user.decorator';
import {
  RequireAuthRoles,
} from '../../../auth/decorators/require-auth-roles.decorator';
import {
  AuthRoleGuard,
} from '../../../auth/guards/auth-role.guard';
import {
  JwtAuthGuard,
} from '../../../auth/guards/jwt-auth.guard';
import {
  getSessionMetadata,
} from '../../../auth/request-metadata';
import type {
  AuthPrincipal,
} from '../../../auth/types/auth.types';
import {
  ProductPublicationDto,
} from '../dto/product-publication.dto';
import {
  CreateProductDto,
  ListProductsDto,
  UpdateProductDto,
} from '../dto/product.dto';
import {
  AdminProductPublicationService,
} from '../services/admin-product-publication.service';
import {
  AdminProductsService,
} from '../services/admin-products.service';

@Controller({
  path: 'admin/products',
  version: '1',
})
@RequireAuthRoles('ADMIN')
@UseGuards(
  JwtAuthGuard,
  AuthRoleGuard,
)
export class AdminProductsController {
  constructor(
    private readonly products:
      AdminProductsService,

    private readonly publication:
      AdminProductPublicationService,
  ) {}

  @Get()
  list(
    @Query()
    query: ListProductsDto,
  ) {
    return this.products
      .list(query);
  }

  @Patch('publication')
  setPublication(
    @Body()
    dto:
      ProductPublicationDto,

    @CurrentUser()
    admin:
      AuthPrincipal,

    @Req()
    request:
      Request,
  ) {
    return this.publication
      .setPublication(
        dto,
        admin.id,
        getSessionMetadata(
          request,
        ),
      );
  }

  @Get(':id')
  get(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    id: string,
  ) {
    return this.products
      .get(id);
  }

  @Post()
  create(
    @Body()
    dto: CreateProductDto,

    @CurrentUser()
    admin: AuthPrincipal,
  ) {
    return this.products
      .create(
        dto,
        admin.id,
      );
  }

  @Patch(':id')
  update(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    id: string,

    @Body()
    dto: UpdateProductDto,

    @CurrentUser()
    admin: AuthPrincipal,
  ) {
    return this.products
      .update(
        id,
        dto,
        admin.id,
      );
  }

  @Delete(':id')
  @HttpCode(
    HttpStatus.NO_CONTENT,
  )
  async remove(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    id: string,

    @CurrentUser()
    admin: AuthPrincipal,
  ): Promise<void> {
    await this.products
      .remove(
        id,
        admin.id,
      );
  }
}
'''
)


# ------------------------------------------------------------
# Module
# ------------------------------------------------------------

write(
    "src/admin/catalog/admin-catalog.module.ts",
    r'''
import {
  Module,
} from '@nestjs/common';
import {
  APP_INTERCEPTOR,
} from '@nestjs/core';

import {
  AuthModule,
} from '../../auth/auth.module';
import {
  DatabaseModule,
} from '../../database/database.module';
import {
  AdminBrandsController,
} from './controllers/admin-brands.controller';
import {
  AdminCategoriesController,
} from './controllers/admin-categories.controller';
import {
  AdminProductImagesController,
} from './controllers/admin-product-images.controller';
import {
  AdminProductsController,
} from './controllers/admin-products.controller';
import {
  CatalogActivityInterceptor,
} from './interceptors/catalog-activity.interceptor';
import {
  AdminBrandsService,
} from './services/admin-brands.service';
import {
  AdminCategoriesService,
} from './services/admin-categories.service';
import {
  AdminProductImagesService,
} from './services/admin-product-images.service';
import {
  AdminProductPublicationService,
} from './services/admin-product-publication.service';
import {
  AdminProductsService,
} from './services/admin-products.service';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
  ],

  controllers: [
    AdminCategoriesController,
    AdminBrandsController,
    AdminProductsController,
    AdminProductImagesController,
  ],

  providers: [
    AdminCategoriesService,
    AdminBrandsService,
    AdminProductsService,
    AdminProductImagesService,
    AdminProductPublicationService,

    {
      provide:
        APP_INTERCEPTOR,
      useClass:
        CatalogActivityInterceptor,
    },
  ],
})
export class AdminCatalogModule {}
'''
)


# ------------------------------------------------------------
# Patch existing Milestone 13 E2E activation tests
# ------------------------------------------------------------

test_path = (
    ROOT
    / "test/admin-catalog.e2e-spec.ts"
)

test_content = (
    test_path.read_text(
        encoding="utf-8",
    )
)

missing_image_replacement = r'''
  it('does not publish a product without an image', async () => {
    await request(
      app.getHttpServer(),
    )
      .patch(
        '/api/v1/admin/products/publication',
      )
      .set(
        'Authorization',
        `Bearer ${adminAuth.accessToken}`,
      )
      .send({
        productIds: [
          productId,
        ],
        published:
          true,
      })
      .expect(409);
  });
'''

test_content, count1 = re.subn(
    r"""
  it\('does\ not\ activate\ a\ product\ without\ an\ image'.*?
  \}\);
""",
    missing_image_replacement.rstrip(),
    test_content,
    count=1,
    flags=re.S | re.X,
)

publish_replacement = r'''
  it('publishes the complete discounted product through the publication endpoint', async () => {
    const publication =
      await request(
        app.getHttpServer(),
      )
        .patch(
          '/api/v1/admin/products/publication',
        )
        .set(
          'Authorization',
          `Bearer ${adminAuth.accessToken}`,
        )
        .send({
          productIds: [
            productId,
          ],
          published:
            true,
        })
        .expect(200);

    const result =
      parseObject(
        publication.text,
      );

    expect(
      result.published,
    ).toBe(true);

    expect(
      result.changedCount,
    ).toBe(1);

    const response =
      await request(
        app.getHttpServer(),
      )
        .get(
          `/api/v1/admin/products/${productId}`,
        )
        .set(
          'Authorization',
          `Bearer ${adminAuth.accessToken}`,
        )
        .expect(200);

    const body =
      parseObject(
        response.text,
      );

    expect(
      body.status,
    ).toBe(
      'ACTIVE',
    );

    expect(
      typeof body.publishedAt,
    ).toBe(
      'string',
    );
  });
'''

test_content, count2 = re.subn(
    r"""
  it\('activates\ the\ complete\ discounted\ product'.*?
  \}\);
""",
    publish_replacement.rstrip(),
    test_content,
    count=1,
    flags=re.S | re.X,
)

if (
    count1 == 0
    and "it('does not publish a product without an image'"
    not in test_content
):
    raise SystemExit(
        "ERROR: Could not safely patch the missing-image publication E2E test."
    )

if (
    count2 == 0
    and "it('publishes the complete discounted product through the publication endpoint'"
    not in test_content
):
    raise SystemExit(
        "ERROR: Could not safely patch the successful publication E2E test."
    )


# Clean test audit rows before deleting test users.
cleanup_marker = (
    "  async function cleanup():\n"
    "    Promise<void> {\n"
)

cleanup_insert = r'''  async function cleanup():
    Promise<void> {
    const testUsers =
      await prisma.user
        .findMany({
          where: {
            email: {
              in: [
                adminEmail,
                customerEmail,
              ],
            },
          },
          select: {
            id: true,
          },
        });

    const testUserIds =
      testUsers.map(
        (user) =>
          user.id,
      );

    if (
      testUserIds.length > 0
    ) {
      await prisma
        .userActivity
        .deleteMany({
          where: {
            OR: [
              {
                actorUserId: {
                  in:
                    testUserIds,
                },
              },
              {
                subjectUserId: {
                  in:
                    testUserIds,
                },
              },
            ],
          },
        });
    }
'''

if (
    cleanup_marker in
    test_content and
    "const testUsers =" not in
    test_content
):
    test_content = (
        test_content.replace(
            cleanup_marker,
            cleanup_insert,
            1,
        )
    )

test_path.write_text(
    test_content.rstrip() + "\n",
    encoding="utf-8",
)

print(
    "Updated: test/admin-catalog.e2e-spec.ts"
)


# ------------------------------------------------------------
# Dedicated bulk publication E2E
# ------------------------------------------------------------

write(
    "test/admin-product-publication.e2e-spec.ts",
    r'''
import {
  type INestApplication,
} from '@nestjs/common';
import {
  Test,
  type TestingModule,
} from '@nestjs/testing';
import {
  PrismaService,
} from '@poromosiyo/db';
import request from 'supertest';
import type {
  App,
} from 'supertest/types';

import {
  AppModule,
} from '../src/app.module';
import {
  PasswordHasherService,
} from '../src/auth/services/password-hasher.service';
import type {
  AuthenticationResult,
} from '../src/auth/types/auth.types';
import {
  configureApplication,
} from '../src/bootstrap/configure-application';

describe('Poromosiyo admin product publication (e2e)', () => {
  let app:
    INestApplication<App>;

  let prisma:
    PrismaService;

  const suffix =
    `${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;

  const adminEmail =
    `publication-admin-${suffix}@example.test`;

  const customerEmail =
    `publication-customer-${suffix}@example.test`;

  const adminPassword =
    'Poromosiyo-Publication-Admin-123!';

  const customerPassword =
    'Poromosiyo-Publication-Customer-123!';

  const categorySlug =
    `publication-category-${suffix}`;

  let adminAuth:
    AuthenticationResult;

  let customerAuth:
    AuthenticationResult;

  let categoryId =
    '';

  let firstProductId =
    '';

  let secondProductId =
    '';

  beforeAll(async () => {
    const moduleFixture:
      TestingModule =
      await Test
        .createTestingModule({
          imports: [
            AppModule,
          ],
        })
        .compile();

    app =
      moduleFixture
        .createNestApplication<
          INestApplication<App>
        >();

    configureApplication(app);

    await app.init();

    prisma =
      app.get(
        PrismaService,
      );

    await cleanup();

    const passwordHasher =
      app.get(
        PasswordHasherService,
      );

    const adminHash =
      await passwordHasher
        .hash(
          adminPassword,
        );

    await prisma.user.create({
      data: {
        fullName:
          'Publication Admin',
        email:
          adminEmail,
        passwordHash:
          adminHash,
        passwordChangedAt:
          new Date(),
        role:
          'ADMIN',
        emailVerifiedAt:
          new Date(),
      },
    });

    const adminLogin =
      await request(
        app.getHttpServer(),
      )
        .post(
          '/api/v1/admin/login',
        )
        .send({
          email:
            adminEmail,
          password:
            adminPassword,
        })
        .expect(200);

    adminAuth =
      parseAuth(
        adminLogin.text,
      );

    const customerRegistration =
      await request(
        app.getHttpServer(),
      )
        .post(
          '/api/v1/auth/register',
        )
        .send({
          fullName:
            'Publication Customer',
          email:
            customerEmail,
          password:
            customerPassword,
        })
        .expect(201);

    customerAuth =
      parseAuth(
        customerRegistration.text,
      );

    const category =
      await request(
        app.getHttpServer(),
      )
        .post(
          '/api/v1/admin/categories',
        )
        .set(
          'Authorization',
          `Bearer ${adminAuth.accessToken}`,
        )
        .send({
          name:
            'Publication Category',
          slug:
            categorySlug,
        })
        .expect(201);

    categoryId =
      requireString(
        parseObject(
          category.text,
        ).id,
      );

    const first =
      await createProduct(
        `M15-A-${suffix}`,
        'Milestone 15 Product A',
      );

    const second =
      await createProduct(
        `M15-B-${suffix}`,
        'Milestone 15 Product B',
      );

    firstProductId =
      first;

    secondProductId =
      second;

    await addImage(
      firstProductId,
      'a',
    );
  });

  afterAll(async () => {
    await cleanup();

    await app.close();
  });

  it('rejects a customer from product publication', async () => {
    await request(
      app.getHttpServer(),
    )
      .patch(
        '/api/v1/admin/products/publication',
      )
      .set(
        'Authorization',
        `Bearer ${customerAuth.accessToken}`,
      )
      .send({
        productIds: [
          firstProductId,
        ],
        published:
          true,
      })
      .expect(403);
  });

  it('does not allow generic product editing to change publication status', async () => {
    await request(
      app.getHttpServer(),
    )
      .patch(
        `/api/v1/admin/products/${firstProductId}`,
      )
      .set(
        'Authorization',
        `Bearer ${adminAuth.accessToken}`,
      )
      .send({
        status:
          'ACTIVE',
      })
      .expect(400);
  });

  it('rolls back a multi-product publication when one selected product is incomplete', async () => {
    await request(
      app.getHttpServer(),
    )
      .patch(
        '/api/v1/admin/products/publication',
      )
      .set(
        'Authorization',
        `Bearer ${adminAuth.accessToken}`,
      )
      .send({
        productIds: [
          firstProductId,
          secondProductId,
        ],
        published:
          true,
      })
      .expect(409);

    const products =
      await prisma.product
        .findMany({
          where: {
            id: {
              in: [
                firstProductId,
                secondProductId,
              ],
            },
          },
          select: {
            status:
              true,
          },
        });

    expect(
      products.every(
        (product) =>
          product.status ===
          'DRAFT',
      ),
    ).toBe(true);
  });

  it('publishes many selected products atomically', async () => {
    await addImage(
      secondProductId,
      'b',
    );

    const response =
      await request(
        app.getHttpServer(),
      )
        .patch(
          '/api/v1/admin/products/publication',
        )
        .set(
          'Authorization',
          `Bearer ${adminAuth.accessToken}`,
        )
        .send({
          productIds: [
            firstProductId,
            secondProductId,
          ],
          published:
            true,
        })
        .expect(200);

    const body =
      parseObject(
        response.text,
      );

    expect(
      body.published,
    ).toBe(true);

    expect(
      body.selectedCount,
    ).toBe(2);

    expect(
      body.changedCount,
    ).toBe(2);

    const products =
      await prisma.product
        .findMany({
          where: {
            id: {
              in: [
                firstProductId,
                secondProductId,
              ],
            },
          },
        });

    expect(
      products.every(
        (product) =>
          product.status ===
            'ACTIVE' &&
          product.publishedAt !==
            null,
      ),
    ).toBe(true);

    const activities =
      await prisma.userActivity
        .findMany({
          where: {
            actorUserId:
              adminAuth.user.id,
            action:
              'PRODUCT_PUBLISHED',
            resourceId: {
              in: [
                firstProductId,
                secondProductId,
              ],
            },
          },
        });

    expect(
      activities,
    ).toHaveLength(2);
  });

  it('treats repeated publication as an idempotent no-op', async () => {
    const response =
      await request(
        app.getHttpServer(),
      )
        .patch(
          '/api/v1/admin/products/publication',
        )
        .set(
          'Authorization',
          `Bearer ${adminAuth.accessToken}`,
        )
        .send({
          productIds: [
            firstProductId,
            secondProductId,
          ],
          published:
            true,
        })
        .expect(200);

    const body =
      parseObject(
        response.text,
      );

    expect(
      body.changedCount,
    ).toBe(0);
  });

  it('unpublishes many selected products', async () => {
    const response =
      await request(
        app.getHttpServer(),
      )
        .patch(
          '/api/v1/admin/products/publication',
        )
        .set(
          'Authorization',
          `Bearer ${adminAuth.accessToken}`,
        )
        .send({
          productIds: [
            firstProductId,
            secondProductId,
          ],
          published:
            false,
        })
        .expect(200);

    const body =
      parseObject(
        response.text,
      );

    expect(
      body.published,
    ).toBe(false);

    expect(
      body.changedCount,
    ).toBe(2);

    const products =
      await prisma.product
        .findMany({
          where: {
            id: {
              in: [
                firstProductId,
                secondProductId,
              ],
            },
          },
        });

    expect(
      products.every(
        (product) =>
          product.status ===
            'DRAFT' &&
          product.publishedAt ===
            null,
      ),
    ).toBe(true);

    const activities =
      await prisma.userActivity
        .findMany({
          where: {
            actorUserId:
              adminAuth.user.id,
            action:
              'PRODUCT_UNPUBLISHED',
            resourceId: {
              in: [
                firstProductId,
                secondProductId,
              ],
            },
          },
        });

    expect(
      activities,
    ).toHaveLength(2);
  });

  it('persists normal catalog mutation activity', async () => {
    const activity =
      await prisma.userActivity
        .findFirst({
          where: {
            actorUserId:
              adminAuth.user.id,
            action:
              'CATEGORY_CREATED',
            resourceId:
              categoryId,
          },
        });

    expect(
      activity,
    ).not.toBeNull();
  });

  async function createProduct(
    sku:
      string,
    name:
      string,
  ): Promise<string> {
    const response =
      await request(
        app.getHttpServer(),
      )
        .post(
          '/api/v1/admin/products',
        )
        .set(
          'Authorization',
          `Bearer ${adminAuth.accessToken}`,
        )
        .send({
          categoryId,
          name,
          sku:
            sku
              .replace(
                /[^A-Za-z0-9._-]/g,
                '-',
              )
              .slice(
                0,
                64,
              ),
          description:
            'Complete publication-ready product description.',
          originalPrice:
            '10000.00',
          sellingPrice:
            '7500.00',
        })
        .expect(201);

    return requireString(
      parseObject(
        response.text,
      ).id,
    );
  }

  async function addImage(
    productId:
      string,
    suffixValue:
      string,
  ): Promise<void> {
    await request(
      app.getHttpServer(),
    )
      .post(
        `/api/v1/admin/products/${productId}/images`,
      )
      .set(
        'Authorization',
        `Bearer ${adminAuth.accessToken}`,
      )
      .send({
        url:
          `https://example.test/${suffixValue}.jpg`,
        altText:
          `Product ${suffixValue}`,
      })
      .expect(201);
  }

  async function cleanup():
    Promise<void> {
    const users =
      await prisma.user
        .findMany({
          where: {
            email: {
              in: [
                adminEmail,
                customerEmail,
              ],
            },
          },
          select: {
            id:
              true,
          },
        });

    const userIds =
      users.map(
        (user) =>
          user.id,
      );

    if (
      userIds.length > 0
    ) {
      await prisma.userActivity
        .deleteMany({
          where: {
            OR: [
              {
                actorUserId: {
                  in:
                    userIds,
                },
              },
              {
                subjectUserId: {
                  in:
                    userIds,
                },
              },
            ],
          },
        });
    }

    await prisma.product
      .deleteMany({
        where: {
          OR: [
            {
              sku: {
                startsWith:
                  'M15-',
              },
            },
            {
              slug: {
                contains:
                  suffix,
              },
            },
          ],
        },
      });

    await prisma.category
      .deleteMany({
        where: {
          slug:
            categorySlug,
        },
      });

    await prisma.user
      .deleteMany({
        where: {
          email: {
            in: [
              adminEmail,
              customerEmail,
            ],
          },
        },
      });
  }
});

function parseAuth(
  text: string,
): AuthenticationResult {
  const value: unknown =
    JSON.parse(text);

  if (
    typeof value !==
      'object' ||
    value === null
  ) {
    throw new Error(
      'Expected authentication response.',
    );
  }

  return value as
    AuthenticationResult;
}

function parseObject(
  text: string,
): Record<string, unknown> {
  const value: unknown =
    JSON.parse(text);

  if (
    typeof value !==
      'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      'Expected JSON object.',
    );
  }

  return value as
    Record<string, unknown>;
}

function requireString(
  value: unknown,
): string {
  if (
    typeof value !==
    'string'
  ) {
    throw new Error(
      'Expected string.',
    );
  }

  return value;
}
'''
)


# ------------------------------------------------------------
# Documentation
# ------------------------------------------------------------

write(
    "docs/admin-catalog-milestone-15.md",
    r'''
# Admin Catalog — Milestone 15

## Scope

Milestone 15 completes the admin catalog publication workflow and introduces
persistent catalog activity history.

There are still no public/customer catalog endpoints.

## Publication Endpoint

```text
PATCH /api/v1/admin/products/publication
```
'''
)

print()
print("Milestone 15 API PARTIAL setup completed: only the uploaded portion was executed.")
PY
