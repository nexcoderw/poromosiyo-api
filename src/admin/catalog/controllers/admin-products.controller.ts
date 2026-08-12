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
  ProductArchiveDto,
} from '../dto/product-archive.dto';
import {
  ProductPublicationDto,
} from '../dto/product-publication.dto';
import {
  CreateProductDto,
  ListProductsDto,
  UpdateProductDto,
} from '../dto/product.dto';
import {
  AdminProductArchiveService,
} from '../services/admin-product-archive.service';
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

    private readonly archive:
      AdminProductArchiveService,
  ) {}

  @Get()
  list(
    @Query()
    query: ListProductsDto,
  ) {
    return this.products.list(
      query,
    );
  }

  @Patch('publication')
  setPublication(
    @Body()
    dto: ProductPublicationDto,

    @CurrentUser()
    admin: AuthPrincipal,

    @Req()
    request: Request,
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

  @Patch('archive')
  setArchived(
    @Body()
    dto: ProductArchiveDto,

    @CurrentUser()
    admin: AuthPrincipal,

    @Req()
    request: Request,
  ) {
    return this.archive
      .setArchived(
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
    return this.products.get(
      id,
    );
  }

  @Post()
  create(
    @Body()
    dto: CreateProductDto,

    @CurrentUser()
    admin: AuthPrincipal,

    @Req()
    request: Request,
  ) {
    return this.products.create(
      dto,
      admin.id,
      getSessionMetadata(
        request,
      ),
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

    @Req()
    request: Request,
  ) {
    return this.products.update(
      id,
      dto,
      admin.id,
      getSessionMetadata(
        request,
      ),
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

    @Req()
    request: Request,
  ): Promise<void> {
    await this.products.remove(
      id,
      admin.id,
      getSessionMetadata(
        request,
      ),
    );
  }
}
