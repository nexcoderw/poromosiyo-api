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
  CreateCategoryDto,
  ListCategoriesDto,
  UpdateCategoryDto,
} from '../dto/category.dto';
import {
  AdminCategoriesService,
} from '../services/admin-categories.service';

@Controller({
  path: 'admin/categories',
  version: '1',
})
@RequireAuthRoles('ADMIN')
@UseGuards(
  JwtAuthGuard,
  AuthRoleGuard,
)
export class AdminCategoriesController {
  constructor(
    private readonly categories:
      AdminCategoriesService,
  ) {}

  @Get()
  list(
    @Query()
    query: ListCategoriesDto,
  ) {
    return this.categories
      .list(query);
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
    return this.categories
      .get(id);
  }

  @Post()
  create(
    @Body()
    dto: CreateCategoryDto,
    @CurrentUser()
    admin: AuthPrincipal,
  ) {
    return this.categories
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
    dto: UpdateCategoryDto,
    @CurrentUser()
    admin: AuthPrincipal,
  ) {
    return this.categories
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
    await this.categories
      .remove(
        id,
        admin.id,
      );
  }
}
