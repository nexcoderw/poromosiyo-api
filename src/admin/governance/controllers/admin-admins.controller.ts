import {
  Body,
  Controller,
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
import { BlockAccountDto } from '../dto/block-account.dto';
import { CreateAdminDto } from '../dto/create-admin.dto';
import { ListGovernedUsersDto } from '../dto/list-governed-users.dto';
import { ListUserActivitiesDto } from '../dto/list-user-activities.dto';
import { AdminAdminsService } from '../services/admin-admins.service';
import { AdminUserActivitiesService } from '../services/admin-user-activities.service';

@Controller({
  path: 'admin/admins',
  version: '1',
})
@RequireAuthRoles('ADMIN')
@UseGuards(JwtAuthGuard, AuthRoleGuard)
export class AdminAdminsController {
  constructor(
    private readonly admins: AdminAdminsService,
    private readonly activities: AdminUserActivitiesService,
  ) {}

  @Get()
  list(
    @Query()
    query: ListGovernedUsersDto,
  ) {
    return this.admins.list(query);
  }

  @Post()
  @RequireAuthRoles('SUPERADMIN')
  create(
    @Body()
    dto: CreateAdminDto,

    @CurrentUser()
    superadmin: AuthPrincipal,

    @Req()
    request: Request,
  ) {
    return this.admins.create(dto, superadmin, getSessionMetadata(request));
  }

  @Get(':id/activities')
  activitiesForAdmin(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    id: string,

    @Query()
    query: ListUserActivitiesDto,
  ) {
    return this.activities.listAdminActivities(id, query);
  }

  @Patch(':id/block')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAuthRoles('SUPERADMIN')
  async block(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    id: string,

    @Body()
    dto: BlockAccountDto,

    @CurrentUser()
    superadmin: AuthPrincipal,

    @Req()
    request: Request,
  ): Promise<void> {
    await this.admins.block(
      id,
      superadmin,
      dto.reason,
      getSessionMetadata(request),
    );
  }

  @Patch(':id/unblock')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAuthRoles('SUPERADMIN')
  async unblock(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    id: string,

    @CurrentUser()
    superadmin: AuthPrincipal,

    @Req()
    request: Request,
  ): Promise<void> {
    await this.admins.unblock(id, superadmin, getSessionMetadata(request));
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
    return this.admins.get(id);
  }
}
