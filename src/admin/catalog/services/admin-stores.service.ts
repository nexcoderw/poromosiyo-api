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
import type { PaginatedResult } from '../catalog.types';
import type {
  CreateStoreDto,
  ListStoresDto,
  UpdateStoreDto,
} from '../dto/store.dto';
import { isPrismaErrorCode } from '../utils/catalog-prisma-error.util';
import { normalizeCatalogSlug } from '../utils/catalog-slug.util';
import { ImageStorageService } from '../../../storage/image-storage.service';

@Injectable()
export class AdminStoresService {
  private readonly logger = new Logger(AdminStoresService.name);

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
    const store = await this.prisma.store.findUnique({
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

    if (!store) {
      throw new NotFoundException('Store not found.');
    }

    const uploaded = await this.imageStorage.store({
      file,
      owner: 'stores',
      ownerId: store.id,
      slug: store.slug || store.name,
    });

    let updated;

    try {
      updated = await this.prisma.$transaction(async (transaction) => {
        const result = await transaction.store.update({
          where: {
            id,
          },

          data: {
            logo: uploaded,
          },
        });

        await transaction.userActivity.create({
          data: {
            subjectUserId: actorId,

            actorUserId: actorId,

            action: CATALOG_ACTIVITY_ACTION.STORE_LOGO_UPDATED,

            resourceType: CATALOG_RESOURCE_TYPE.STORE,

            resourceId: id,

            description: `Updated store logo: ${store.name}`,

            ipAddress: metadata.ipAddress,

            userAgent: metadata.userAgent,
          },
        });

        return result;
      });
    } catch (error: unknown) {
      await this.imageStorage.deleteQuietly(uploaded);

      throw error;
    }

    await this.imageStorage.deleteQuietly(store.logo);

    return updated;
  }

  async removeLogo(
    id: string,
    actorId: string,
    metadata: SessionMetadata,
  ): Promise<void> {
    const store = await this.prisma.store.findUnique({
      where: {
        id,
      },

      select: {
        id: true,
        name: true,
        logo: true,
      },
    });

    if (!store) {
      throw new NotFoundException('Store not found.');
    }

    if (!store.logo) {
      return;
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.store.update({
        where: {
          id,
        },

        data: {
          logo: null,
        },
      });

      await transaction.userActivity.create({
        data: {
          subjectUserId: actorId,

          actorUserId: actorId,

          action: CATALOG_ACTIVITY_ACTION.STORE_LOGO_REMOVED,

          resourceType: CATALOG_RESOURCE_TYPE.STORE,

          resourceId: id,

          description: `Removed store logo: ${store.name}`,

          ipAddress: metadata.ipAddress,

          userAgent: metadata.userAgent,
        },
      });
    });

    await this.imageStorage.deleteQuietly(store.logo);
  }

  async list(query: ListStoresDto): Promise<PaginatedResult<unknown>> {
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
      this.prisma.store.count({
        where,
      }),

      this.prisma.store.findMany({
        where,

        skip: (query.page - 1) * query.limit,

        take: query.limit,

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
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async get(id: string) {
    const store = await this.prisma.store.findUnique({
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

    if (!store) {
      throw new NotFoundException('Store not found.');
    }

    return store;
  }

  async create(
    dto: CreateStoreDto,
    actorId: string,
    metadata: SessionMetadata,
  ) {
    const slug = await this.resolveUniqueSlug(dto.slug ?? dto.name, null);

    try {
      const store = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.store.create({
          data: {
            name: dto.name.trim(),

            slug,

            description: normalizeNullableText(dto.description),

            website: dto.website ?? null,

            isActive: dto.isActive ?? true,
          },
        });

        await transaction.userActivity.create({
          data: {
            subjectUserId: actorId,

            actorUserId: actorId,

            action: CATALOG_ACTIVITY_ACTION.STORE_CREATED,

            resourceType: CATALOG_RESOURCE_TYPE.STORE,

            resourceId: created.id,

            description: `Created store: ${created.name}`,

            ipAddress: metadata.ipAddress,

            userAgent: metadata.userAgent,
          },
        });

        return created;
      });

      this.logger.log(
        `catalog.store.created actor=${actorId} store=${store.id}`,
      );

      return store;
    } catch (error: unknown) {
      if (isPrismaErrorCode(error, 'P2002')) {
        throw new ConflictException('Store slug already exists.');
      }

      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateStoreDto,
    actorId: string,
    metadata: SessionMetadata,
  ) {
    const existing = await this.prisma.store.findUnique({
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
      throw new NotFoundException('Store not found.');
    }

    if (dto.isActive === false && existing._count.products > 0) {
      throw new ConflictException(
        'Unpublish, archive, or move active products before deactivating this store.',
      );
    }

    let slug: string | undefined;

    if (dto.slug !== undefined) {
      slug = await this.resolveUniqueSlug(dto.slug, id);
    }

    try {
      const store = await this.prisma.$transaction(async (transaction) => {
        const updated = await transaction.store.update({
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
          data: {
            subjectUserId: actorId,

            actorUserId: actorId,

            action: CATALOG_ACTIVITY_ACTION.STORE_UPDATED,

            resourceType: CATALOG_RESOURCE_TYPE.STORE,

            resourceId: updated.id,

            description: `Updated store: ${updated.name}`,

            ipAddress: metadata.ipAddress,

            userAgent: metadata.userAgent,
          },
        });

        return updated;
      });

      this.logger.log(
        `catalog.store.updated actor=${actorId} store=${store.id}`,
      );

      return store;
    } catch (error: unknown) {
      if (isPrismaErrorCode(error, 'P2002')) {
        throw new ConflictException('Store slug already exists.');
      }

      throw error;
    }
  }

  async remove(
    id: string,
    actorId: string,
    metadata: SessionMetadata,
  ): Promise<void> {
    const store = await this.prisma.store.findUnique({
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

    if (!store) {
      throw new NotFoundException('Store not found.');
    }

    if (store._count.products > 0) {
      throw new ConflictException(
        'Move or delete all products before deleting this store.',
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.store.delete({
        where: {
          id,
        },
      });

      await transaction.userActivity.create({
        data: {
          subjectUserId: actorId,

          actorUserId: actorId,

          action: CATALOG_ACTIVITY_ACTION.STORE_DELETED,

          resourceType: CATALOG_RESOURCE_TYPE.STORE,

          resourceId: id,

          description: `Deleted store: ${store.name}`,

          ipAddress: metadata.ipAddress,

          userAgent: metadata.userAgent,
        },
      });
    });

    await this.imageStorage.deleteQuietly(store.logo);

    this.logger.log(`catalog.store.deleted actor=${actorId} store=${id}`);
  }

  private async resolveUniqueSlug(
    input: string,
    excludeId: string | null,
  ): Promise<string> {
    const base = normalizeCatalogSlug(input);

    for (let index = 1; index <= 100; index += 1) {
      const suffix = index === 1 ? '' : `-${index}`;

      const candidate = `${base.slice(0, 191 - suffix.length)}${suffix}`;

      const existing = await this.prisma.store.findUnique({
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

    throw new ConflictException('Unable to create a unique store slug.');
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
