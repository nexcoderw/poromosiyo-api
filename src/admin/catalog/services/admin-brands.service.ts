import { ImageStorageService } from '../../../storage/image-storage.service';
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

import type { PaginatedResult } from '../catalog.types';
import type {
  CreateBrandDto,
  ListBrandsDto,
  UpdateBrandDto,
} from '../dto/brand.dto';
import { isPrismaErrorCode } from '../utils/catalog-prisma-error.util';
import { normalizeCatalogSlug } from '../utils/catalog-slug.util';

@Injectable()
export class AdminBrandsService {
  private readonly logger = new Logger(AdminBrandsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly imageStorage: ImageStorageService,
  ) {}

  async updateLogo(
    id: string,
    file: Express.Multer.File,
    actorId: string,
    metadata: SessionMetadata,
  ) {
    const brand =
      await this.prisma
        .brand
        .findUnique({
          where: {
            id,
          },

          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        });

    if (!brand) {
      throw new NotFoundException(
        'Brand not found.',
      );
    }

    const uploaded =
      await this.imageStorage
        .store({
          file,
          owner:
            'brands',
          ownerId:
            brand.id,
          slug:
            brand.slug ||
            brand.name,
        });

    let updated;

    try {
      updated =
        await this.prisma
          .$transaction(
            async (
              transaction,
            ) => {
              const result =
                await transaction
                  .brand
                  .update({
                    where: {
                      id,
                    },

                    data: {
                      logo:
                        uploaded,
                    },
                  });

              await transaction
                .userActivity
                .create({
                  data:
                    createCatalogActivityData({
                      actorId,

                      action:
                        CATALOG_ACTIVITY_ACTION
                          .BRAND_LOGO_UPDATED,

                      resourceType:
                        CATALOG_RESOURCE_TYPE
                          .BRAND,

                      resourceId:
                        brand.id,

                      description:
                        `Updated brand logo: ${brand.name}`,

                      metadata,
                    }),
                });

              return result;
            },
          );
    } catch (
      error: unknown
    ) {
      await this.imageStorage
        .deleteQuietly(
          uploaded,
        );

      throw error;
    }

    await this.imageStorage
      .deleteQuietly(
        brand.logo,
      );

    return updated;
  }

  async removeLogo(
    id: string,
    actorId: string,
    metadata: SessionMetadata,
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
            name: true,
            logo: true,
          },
        });

    if (!brand) {
      throw new NotFoundException(
        'Brand not found.',
      );
    }

    if (!brand.logo) {
      return;
    }

    await this.prisma
      .$transaction(
        async (
          transaction,
        ) => {
          await transaction
            .brand
            .update({
              where: {
                id,
              },

              data: {
                logo:
                  null,
              },
            });

          await transaction
            .userActivity
            .create({
              data:
                createCatalogActivityData({
                  actorId,

                  action:
                    CATALOG_ACTIVITY_ACTION
                      .BRAND_LOGO_REMOVED,

                  resourceType:
                    CATALOG_RESOURCE_TYPE
                      .BRAND,

                  resourceId:
                    id,

                  description:
                    `Removed brand logo: ${brand.name}`,

                  metadata,
                }),
            });
        },
      );

    await this.imageStorage
      .deleteQuietly(
        brand.logo,
      );
  }

  async list(query: ListBrandsDto): Promise<PaginatedResult<unknown>> {
    const page = query.page;

    const limit = query.limit;

    const search = query.search?.trim();

    const where = {
      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                },
              },
              {
                slug: {
                  contains: search.toLowerCase(),
                },
              },
            ],
          }
        : {}),

      ...(query.isActive === undefined
        ? {}
        : {
            isActive: query.isActive,
          }),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.brand.count({
        where,
      }),

      this.prisma.brand.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          name: 'asc',
        },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async get(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found.');
    }

    return brand;
  }

  async create(
    dto: CreateBrandDto,
    actorId: string,
    metadata: SessionMetadata,
  ) {
    const slug = await this.resolveUniqueSlug(dto.slug ?? dto.name, null);

    try {
      const brand = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.brand.create({
          data: {
            name: dto.name.trim(),

            slug,

            description: normalizeNullableText(dto.description),


            website: dto.website ?? null,

            isActive: dto.isActive ?? true,
          },
        });

        await transaction.userActivity.create({
          data: createCatalogActivityData({
            actorId,

            action: CATALOG_ACTIVITY_ACTION.BRAND_CREATED,

            resourceType: CATALOG_RESOURCE_TYPE.BRAND,

            resourceId: created.id,

            description: `Created brand: ${created.name}`,

            metadata,
          }),
        });

        return created;
      });

      this.logger.log(
        `catalog.brand.created actor=${actorId} brand=${brand.id}`,
      );

      return brand;
    } catch (error: unknown) {
      if (isPrismaErrorCode(error, 'P2002')) {
        throw new ConflictException('Brand slug already exists.');
      }

      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateBrandDto,
    actorId: string,
    metadata: SessionMetadata,
  ) {
    const existing = await this.prisma.brand.findUnique({
      where: {
        id,
      },

      include: {
        _count: {
          select: {
            products: {
              where: {
                status: 'ACTIVE',
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Brand not found.');
    }

    if (dto.isActive === false && existing._count.products > 0) {
      throw new ConflictException(
        'Remove or archive active products before deactivating this brand.',
      );
    }

    let slug: string | undefined;

    if (dto.slug !== undefined) {
      slug = await this.resolveUniqueSlug(dto.slug, id);
    }

    try {
      const brand = await this.prisma.$transaction(async (transaction) => {
        const updated = await transaction.brand.update({
          where: {
            id,
          },

          data: {
            name: dto.name?.trim(),

            slug,

            description:
              dto.description === undefined
                ? undefined
                : normalizeNullableText(dto.description),


            website: dto.website,

            isActive: dto.isActive,
          },
        });

        await transaction.userActivity.create({
          data: createCatalogActivityData({
            actorId,

            action: CATALOG_ACTIVITY_ACTION.BRAND_UPDATED,

            resourceType: CATALOG_RESOURCE_TYPE.BRAND,

            resourceId: updated.id,

            description: `Updated brand: ${updated.name}`,

            metadata,
          }),
        });

        return updated;
      });

      this.logger.log(`catalog.brand.updated actor=${actorId} brand=${id}`);

      return brand;
    } catch (error: unknown) {
      if (isPrismaErrorCode(error, 'P2002')) {
        throw new ConflictException('Brand slug already exists.');
      }

      throw error;
    }
  }

  async remove(
    id: string,
    actorId: string,
    metadata: SessionMetadata,
  ): Promise<void> {
    const existing = await this.prisma.brand.findUnique({
      where: {
        id,
      },

      select: {
        id: true,
        name: true,
        logo: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Brand not found.');
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.brand.delete({
        where: {
          id,
        },
      });

      await transaction.userActivity.create({
        data: createCatalogActivityData({
          actorId,

          action: CATALOG_ACTIVITY_ACTION.BRAND_DELETED,

          resourceType: CATALOG_RESOURCE_TYPE.BRAND,

          resourceId: id,

          description: `Deleted brand: ${existing.name}`,

          metadata,
        }),
      });
    });

    await this.imageStorage
      .deleteQuietly(
        existing.logo,
      );

    this.logger.log(`catalog.brand.deleted actor=${actorId} brand=${id}`);
  }

  private async resolveUniqueSlug(
    input: string,
    excludeId: string | null,
  ): Promise<string> {
    const base = normalizeCatalogSlug(input);

    for (let index = 1; index <= 100; index += 1) {
      const suffix = index === 1 ? '' : `-${index}`;

      const candidate = `${base.slice(0, 191 - suffix.length)}${suffix}`;

      const existing = await this.prisma.brand.findUnique({
        where: {
          slug: candidate,
        },
        select: {
          id: true,
        },
      });

      if (!existing || existing.id === excludeId) {
        return candidate;
      }
    }

    throw new ConflictException('Unable to create a unique brand slug.');
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
