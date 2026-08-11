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
import type { Request } from 'express';

import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireAuthRoles } from '../../../auth/decorators/require-auth-roles.decorator';
import { AuthRoleGuard } from '../../../auth/guards/auth-role.guard';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { getSessionMetadata } from '../../../auth/request-metadata';
import type { AuthPrincipal } from '../../../auth/types/auth.types';
import { ProductPublicationDto } from '../dto/product-publication.dto';
import {
  CreateProductDto,
  ListProductsDto,
  UpdateProductDto,
} from '../dto/product.dto';
import { AdminProductPublicationService } from '../services/admin-product-publication.service';
import { AdminProductsService } from '../services/admin-products.service';

@Controller({
  path: 'admin/products',
  version: '1',
})
@RequireAuthRoles('ADMIN')
@UseGuards(JwtAuthGuard, AuthRoleGuard)
export class AdminProductsController {
  constructor(
    private readonly products: AdminProductsService,

    private readonly publication: AdminProductPublicationService,
  ) {}

  @Get()
  list(
    @Query()
    query: ListProductsDto,
  ) {
    return this.products.list(query);
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
    return this.publication.setPublication(
      dto,
      admin.id,
      getSessionMetadata(request),
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
    return this.products.get(id);
  }

  @Post()
  create(
    @Body()
    dto: CreateProductDto,

    @CurrentUser()
    admin: AuthPrincipal,
  ) {
    return this.products.create(dto, admin.id);
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
    return this.products.update(id, dto, admin.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
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
    await this.products.remove(id, admin.id);
  }
}
