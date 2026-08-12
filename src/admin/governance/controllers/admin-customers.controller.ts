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
  BlockAccountDto,
} from '../dto/block-account.dto';
import {
  ListGovernedUsersDto,
} from '../dto/list-governed-users.dto';
import {
  ListUserActivitiesDto,
} from '../dto/list-user-activities.dto';
import {
  AdminCustomersService,
} from '../services/admin-customers.service';
import {
  AdminManagedSessionsService,
} from '../services/admin-managed-sessions.service';
import {
  AdminUserActivitiesService,
} from '../services/admin-user-activities.service';

@Controller({
  path: 'admin/customers',
  version: '1',
})
@RequireAuthRoles('ADMIN')
@UseGuards(
  JwtAuthGuard,
  AuthRoleGuard,
)
export class AdminCustomersController {
  constructor(
    private readonly customers:
      AdminCustomersService,

    private readonly activities:
      AdminUserActivitiesService,

    private readonly sessions:
      AdminManagedSessionsService,
  ) {}

  @Get()
  list(
    @Query()
    query:
      ListGovernedUsersDto,
  ) {
    return this.customers.list(
      query,
    );
  }

  @Get(':id/activities')
  activitiesForCustomer(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    id: string,

    @Query()
    query:
      ListUserActivitiesDto,
  ) {
    return this.activities
      .listCustomerActivities(
        id,
        query,
      );
  }

  @Get(':id/sessions')
  listSessions(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    id: string,
  ) {
    return this.sessions
      .listCustomer(
        id,
      );
  }

  @Delete(
    ':id/sessions/:sessionId',
  )
  @HttpCode(
    HttpStatus.NO_CONTENT,
  )
  async revokeSession(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    id: string,

    @Param(
      'sessionId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    sessionId: string,

    @CurrentUser()
    admin: AuthPrincipal,

    @Req()
    request: Request,
  ): Promise<void> {
    await this.sessions
      .revokeCustomer(
        id,
        sessionId,
        admin,
        getSessionMetadata(
          request,
        ),
      );
  }

  @Post(':id/logout-all')
  @HttpCode(
    HttpStatus.NO_CONTENT,
  )
  async logoutAll(
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
    await this.sessions
      .logoutAllCustomer(
        id,
        admin,
        getSessionMetadata(
          request,
        ),
      );
  }

  @Patch(':id/block')
  @HttpCode(
    HttpStatus.NO_CONTENT,
  )
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
    admin: AuthPrincipal,

    @Req()
    request: Request,
  ): Promise<void> {
    await this.customers.block(
      id,
      admin,
      dto.reason,
      getSessionMetadata(
        request,
      ),
    );
  }

  @Patch(':id/unblock')
  @HttpCode(
    HttpStatus.NO_CONTENT,
  )
  async unblock(
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
    await this.customers.unblock(
      id,
      admin,
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
    return this.customers.get(
      id,
    );
  }
}
