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
import {
  CreateBrandDto,
  ListBrandsDto,
  UpdateBrandDto,
} from '../dto/brand.dto';
import { AdminBrandsService } from '../services/admin-brands.service';

@Controller({
  path: 'admin/brands',
  version: '1',
})
@RequireAuthRoles('ADMIN')
@UseGuards(JwtAuthGuard, AuthRoleGuard)
export class AdminBrandsController {
  constructor(private readonly brands: AdminBrandsService) {}

  @Get()
  list(
    @Query()
    query: ListBrandsDto,
  ) {
    return this.brands.list(query);
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
    return this.brands.get(id);
  }

  @Post()
  create(
    @Body()
    dto: CreateBrandDto,

    @CurrentUser()
    admin: AuthPrincipal,

    @Req()
    request: Request,
  ) {
    return this.brands.create(dto, admin.id, getSessionMetadata(request));
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
    dto: UpdateBrandDto,

    @CurrentUser()
    admin: AuthPrincipal,

    @Req()
    request: Request,
  ) {
    return this.brands.update(id, dto, admin.id, getSessionMetadata(request));
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
    await this.brands.remove(id, admin.id, getSessionMetadata(request));
  }
}
