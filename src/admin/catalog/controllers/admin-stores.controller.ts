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
import { IMAGE_UPLOAD_FIELD } from '../../../storage/image-storage.constants';
import { imageUploadOptions } from '../../../storage/image-upload.options';
import {
  CreateStoreDto,
  ListStoresDto,
  UpdateStoreDto,
} from '../dto/store.dto';
import { AdminStoresService } from '../services/admin-stores.service';

@Controller({
  path: 'admin/stores',
  version: '1',
})
@RequireAuthRoles('ADMIN')
@UseGuards(JwtAuthGuard, AuthRoleGuard)
export class AdminStoresController {
  constructor(private readonly stores: AdminStoresService) {}

  @Get()
  list(
    @Query()
    query: ListStoresDto,
  ) {
    return this.stores.list(query);
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
    return this.stores.get(id);
  }

  @Post()
  create(
    @Body()
    dto: CreateStoreDto,

    @CurrentUser()
    admin: AuthPrincipal,

    @Req()
    request: Request,
  ) {
    return this.stores.create(dto, admin.id, getSessionMetadata(request));
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
    dto: UpdateStoreDto,

    @CurrentUser()
    admin: AuthPrincipal,

    @Req()
    request: Request,
  ) {
    return this.stores.update(id, dto, admin.id, getSessionMetadata(request));
  }

  @Patch(':id/logo')
  @ApiImageUpload()
  @UseInterceptors(FileInterceptor(IMAGE_UPLOAD_FIELD, imageUploadOptions))
  updateLogo(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    id: string,

    @UploadedFile()
    image: Express.Multer.File,

    @CurrentUser()
    admin: AuthPrincipal,

    @Req()
    request: Request,
  ) {
    return this.stores.updateLogo(
      id,
      image,
      admin.id,
      getSessionMetadata(request),
    );
  }

  @Delete(':id/logo')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeLogo(
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
    await this.stores.removeLogo(id, admin.id, getSessionMetadata(request));
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

    @Req()
    request: Request,
  ): Promise<void> {
    await this.stores.remove(id, admin.id, getSessionMetadata(request));
  }
}
