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
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';

import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { RequireAuthRoles } from '../../../auth/decorators/require-auth-roles.decorator';
import { AuthRoleGuard } from '../../../auth/guards/auth-role.guard';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { getSessionMetadata } from '../../../auth/request-metadata';
import type { AuthPrincipal } from '../../../auth/types/auth.types';
import { ApiImageUpload } from '../../../storage/api-image-upload.decorator';
import {
  CreateProductImageDto,
  UpdateProductImageDto,
} from '../dto/product-image.dto';
import { AdminProductImagesService } from '../services/admin-product-images.service';
import { IMAGE_UPLOAD_FIELD } from '../../../storage/image-storage.constants';
import { imageUploadOptions } from '../../../storage/image-upload.options';

@Controller({
  path: 'admin/products/:productId/images',
  version: '1',
})
@RequireAuthRoles('ADMIN')
@UseGuards(JwtAuthGuard, AuthRoleGuard)
export class AdminProductImagesController {
  constructor(private readonly images: AdminProductImagesService) {}

  @Post()
  @ApiImageUpload({
    altText: {
      type: 'string',
      description: 'Accessible alternative text for the product image.',
    },
    sortOrder: {
      type: 'integer',
      minimum: 0,
    },
    isPrimary: {
      type: 'boolean',
    },
  })
  @UseInterceptors(FileInterceptor(IMAGE_UPLOAD_FIELD, imageUploadOptions))
  create(
    @Param(
      'productId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    productId: string,

    @UploadedFile()
    image: Express.Multer.File,

    @Body()
    dto: CreateProductImageDto,

    @CurrentUser()
    admin: AuthPrincipal,

    @Req()
    request: Request,
  ) {
    return this.images.create(
      productId,
      image,
      dto,
      admin.id,
      getSessionMetadata(request),
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

    @Req()
    request: Request,
  ) {
    return this.images.update(
      productId,
      imageId,
      dto,
      admin.id,
      getSessionMetadata(request),
    );
  }

  @Delete(':imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
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

    @Req()
    request: Request,
  ): Promise<void> {
    await this.images.remove(
      productId,
      imageId,
      admin.id,
      getSessionMetadata(request),
    );
  }
}
