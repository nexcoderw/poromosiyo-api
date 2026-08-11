import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@poromosiyo/db';

import type {
  CreateCategoryDto,
  ListCategoriesDto,
  UpdateCategoryDto,
} from '../dto/category.dto';
import type { PaginatedResult } from '../catalog.types';
import { isPrismaErrorCode } from '../utils/catalog-prisma-error.util';
import { normalizeCatalogSlug } from '../utils/catalog-slug.util';

@Injectable()
export class AdminCategoriesService {
  private readonly logger = new Logger(AdminCategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListCategoriesDto): Promise<PaginatedResult<unknown>> {
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

      ...(query.rootOnly
        ? {
            parentId: null,
          }
        : query.parentId
          ? {
              parentId: query.parentId,
            }
          : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.category.count({
        where,
      }),

      this.prisma.category.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          {
            sortOrder: 'asc',
          },
          {
            name: 'asc',
          },
        ],
        include: {
          parent: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              children: true,
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
    const category = await this.prisma.category.findUnique({
      where: {
        id,
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          orderBy: [
            {
              sortOrder: 'asc',
            },
            {
              name: 'asc',
            },
          ],
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            sortOrder: true,
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found.');
    }

    return category;
  }

  async create(dto: CreateCategoryDto, actorId: string) {
    if (dto.parentId) {
      await this.assertValidParent(dto.parentId, null);
    }

    const slug = await this.resolveUniqueSlug(dto.slug ?? dto.name, null);

    try {
      const category = await this.prisma.category.create({
        data: {
          name: dto.name.trim(),
          slug,
          parentId: dto.parentId ?? null,
          description: normalizeNullableText(dto.description),
          image: dto.image ?? null,
          isActive: dto.isActive ?? true,
          sortOrder: dto.sortOrder ?? 0,
        },
      });

      this.logger.log(
        `catalog.category.created actor=${actorId} category=${category.id}`,
      );

      return category;
    } catch (error: unknown) {
      if (isPrismaErrorCode(error, 'P2002')) {
        throw new ConflictException('Category slug already exists.');
      }

      throw error;
    }
  }

  async update(id: string, dto: UpdateCategoryDto, actorId: string) {
    const existing = await this.prisma.category.findUnique({
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
      throw new NotFoundException('Category not found.');
    }

    if (dto.isActive === false && existing._count.products > 0) {
      throw new ConflictException(
        'Deactivate or move active products before deactivating this category.',
      );
    }

    if (dto.parentId !== undefined) {
      if (dto.parentId) {
        await this.assertValidParent(dto.parentId, id);
      }
    }

    let slug: string | undefined;

    if (dto.slug !== undefined) {
      slug = await this.resolveUniqueSlug(dto.slug, id);
    }

    try {
      const category = await this.prisma.category.update({
        where: {
          id,
        },
        data: {
          name: dto.name?.trim(),
          slug,
          parentId: dto.parentId,
          description:
            dto.description === undefined
              ? undefined
              : normalizeNullableText(dto.description),
          image: dto.image,
          isActive: dto.isActive,
          sortOrder: dto.sortOrder,
        },
      });

      this.logger.log(
        `catalog.category.updated actor=${actorId} category=${id}`,
      );

      return category;
    } catch (error: unknown) {
      if (isPrismaErrorCode(error, 'P2002')) {
        throw new ConflictException('Category slug already exists.');
      }

      throw error;
    }
  }

  async remove(id: string, actorId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            children: true,
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found.');
    }

    if (category._count.children > 0) {
      throw new ConflictException(
        'Delete or move child categories before deleting this category.',
      );
    }

    if (category._count.products > 0) {
      throw new ConflictException(
        'Delete or move products before deleting this category.',
      );
    }

    try {
      await this.prisma.category.delete({
        where: {
          id,
        },
      });

      this.logger.log(
        `catalog.category.deleted actor=${actorId} category=${id}`,
      );
    } catch (error: unknown) {
      if (isPrismaErrorCode(error, 'P2003')) {
        throw new ConflictException(
          'Category is still referenced by catalog data.',
        );
      }

      throw error;
    }
  }

  private async assertValidParent(
    parentId: string,
    categoryId: string | null,
  ): Promise<void> {
    if (categoryId && parentId === categoryId) {
      throw new ConflictException('A category cannot be its own parent.');
    }

    let current = await this.prisma.category.findUnique({
      where: {
        id: parentId,
      },
      select: {
        id: true,
        parentId: true,
      },
    });

    if (!current) {
      throw new NotFoundException('Parent category not found.');
    }

    const visited = new Set<string>();

    while (current) {
      if (categoryId && current.id === categoryId) {
        throw new ConflictException(
          'Category hierarchy cannot contain a cycle.',
        );
      }

      if (visited.has(current.id)) {
        throw new ConflictException(
          'Existing category hierarchy contains a cycle.',
        );
      }

      visited.add(current.id);

      if (!current.parentId) {
        break;
      }

      current = await this.prisma.category.findUnique({
        where: {
          id: current.parentId,
        },
        select: {
          id: true,
          parentId: true,
        },
      });

      if (!current) {
        break;
      }
    }
  }

  private async resolveUniqueSlug(
    input: string,
    excludeId: string | null,
  ): Promise<string> {
    const base = normalizeCatalogSlug(input);

    for (let index = 1; index <= 100; index += 1) {
      const suffix = index === 1 ? '' : `-${index}`;

      const candidate = `${base.slice(0, 191 - suffix.length)}${suffix}`;

      const existing = await this.prisma.category.findUnique({
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

    throw new ConflictException('Unable to create a unique category slug.');
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
