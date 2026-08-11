import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

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
import type {
  AuthPrincipal,
} from '../../../auth/types/auth.types';
import {
  CreateProductImageDto,
  UpdateProductImageDto,
} from '../dto/product-image.dto';
import {
  AdminProductImagesService,
} from '../services/admin-product-images.service';

@Controller({
  path: 'admin/products/:productId/images',
  version: '1',
})
@RequireAuthRoles('ADMIN')
@UseGuards(
  JwtAuthGuard,
  AuthRoleGuard,
)
export class AdminProductImagesController {
  constructor(
    private readonly images:
      AdminProductImagesService,
  ) {}

  @Post()
  create(
    @Param(
      'productId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    productId: string,
    @Body()
    dto: CreateProductImageDto,
    @CurrentUser()
    admin: AuthPrincipal,
  ) {
    return this.images
      .create(
        productId,
        dto,
        admin.id,
      );
  }

  @Patch(':imageId')
  update(
    @Param(
      'productId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    productId: string,

    @Param(
      'imageId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    imageId: string,

    @Body()
    dto: UpdateProductImageDto,

    @CurrentUser()
    admin: AuthPrincipal,
  ) {
    return this.images
      .update(
        productId,
        imageId,
        dto,
        admin.id,
      );
  }

  @Delete(':imageId')
  @HttpCode(
    HttpStatus.NO_CONTENT,
  )
  async remove(
    @Param(
      'productId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    productId: string,

    @Param(
      'imageId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    imageId: string,

    @CurrentUser()
    admin: AuthPrincipal,
  ): Promise<void> {
    await this.images
      .remove(
        productId,
        imageId,
        admin.id,
      );
  }
}
